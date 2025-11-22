# SymptoMap Deployment Guide

## Overview

This guide covers deploying SymptoMap to production environments using Kubernetes, Docker, and modern DevOps practices.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Kubernetes     │    │   Monitoring    │
│   (Nginx/ALB)   │◄──►│   Cluster        │◄──►│   Stack         │
│                 │    │                  │    │   (Prometheus)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Data Layer     │
                    │   - PostgreSQL   │
                    │   - Redis        │
                    │   - Elasticsearch│
                    └──────────────────┘
```

## Prerequisites

### Required Tools
- Docker 24.0+
- Kubernetes 1.27+
- kubectl
- Helm 3.0+
- AWS CLI (for AWS deployments)

### Infrastructure Requirements
- **Minimum**: 4 vCPU, 16GB RAM, 100GB SSD
- **Recommended**: 8 vCPU, 32GB RAM, 500GB SSD
- **Production**: Auto-scaling group with 3-20 instances

## Environment Setup

### 1. Development Environment

```bash
# Clone the repository
git clone https://github.com/your-org/symptomap.git
cd symptomap

# Run setup script
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# Start development environment
docker-compose up -d
```

### 2. Staging Environment

```bash
# Configure AWS CLI
aws configure

# Create EKS cluster
eksctl create cluster \
  --name sympto-map-staging \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type m5.large \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10

# Deploy to staging
./scripts/deploy.sh staging
```

### 3. Production Environment

```bash
# Create production cluster
eksctl create cluster \
  --name sympto-map-production \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type m5.xlarge \
  --nodes 5 \
  --nodes-min 3 \
  --nodes-max 20

# Deploy to production
./scripts/deploy.sh production
```

## Kubernetes Configuration

### Namespace and Resources

```yaml
# Apply resource quotas and limits
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml
```

### Database Setup

```bash
# Create PostgreSQL with PostGIS
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgresql bitnami/postgresql \
  --set auth.postgresPassword=secretpassword \
  --set primary.persistence.size=100Gi \
  --namespace sympto-map

# Create Redis cluster
helm install redis bitnami/redis \
  --set auth.password=redispassword \
  --set master.persistence.size=50Gi \
  --namespace sympto-map
```

### Application Deployment

```bash
# Deploy applications
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml
kubectl apply -f kubernetes/hpa.yaml

# Verify deployment
kubectl get pods -n sympto-map
kubectl get services -n sympto-map
kubectl get ingress -n sympto-map
```

## SSL/TLS Configuration

### Using cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create cluster issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@symptomap.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Monitoring Setup

### Prometheus and Grafana

```bash
# Install monitoring stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/values.yaml

# Access Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
# Default: admin/prom-operator
```

### Log Aggregation

```bash
# Install Elasticsearch and Kibana
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace

helm install kibana elastic/kibana \
  --namespace logging
```

## Backup and Disaster Recovery

### Database Backups

```bash
# Create backup job
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: sympto-map
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U postgres symptomap | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
              aws s3 cp /backup/ s3://sympto-map-backups/db/ --recursive
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
EOF
```

### Application Backup

```bash
# Backup Kubernetes resources
kubectl get all -n sympto-map -o yaml > backup/k8s-resources.yaml

# Backup persistent volumes
velero backup create symptomap-backup --include-namespaces sympto-map
```

## Scaling Configuration

### Horizontal Pod Autoscaler

```yaml
# HPA is already configured in kubernetes/hpa.yaml
# Monitor scaling:
kubectl get hpa -n sympto-map
kubectl describe hpa sympto-map-api-hpa -n sympto-map
```

### Cluster Autoscaler

```bash
# Install cluster autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Configure for your cluster
kubectl -n kube-system annotate deployment.apps/cluster-autoscaler \
  cluster-autoscaler.kubernetes.io/safe-to-evict="false"
```

## Security Configuration

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sympto-map-network-policy
  namespace: sympto-map
spec:
  podSelector:
    matchLabels:
      app: sympto-map-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8787
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sympto-map
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_outbreak_reports_created_at 
ON outbreak_reports (created_at DESC);

CREATE INDEX CONCURRENTLY idx_outbreak_reports_location_disease 
ON outbreak_reports (disease_id, latitude, longitude);

-- Configure PostgreSQL
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

### Application Optimization

```bash
# Configure resource requests and limits
kubectl patch deployment sympto-map-api -n sympto-map -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "api",
          "resources": {
            "requests": {
              "memory": "512Mi",
              "cpu": "250m"
            },
            "limits": {
              "memory": "1Gi",
              "cpu": "1000m"
            }
          }
        }]
      }
    }
  }
}'
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues
```bash
# Check pod status
kubectl get pods -n sympto-map
kubectl describe pod <pod-name> -n sympto-map
kubectl logs <pod-name> -n sympto-map

# Check resource usage
kubectl top pods -n sympto-map
kubectl top nodes
```

#### Database Connection Issues
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h postgresql.sympto-map.svc.cluster.local -U postgres -d symptomap

# Check database logs
kubectl logs -l app=postgresql -n sympto-map
```

#### Performance Issues
```bash
# Check HPA status
kubectl get hpa -n sympto-map
kubectl describe hpa sympto-map-api-hpa -n sympto-map

# Monitor resource usage
kubectl top pods -n sympto-map --containers
```

### Health Checks

```bash
# API health check
curl -f https://api.symptomap.com/health

# Database health check
kubectl exec -it postgresql-0 -n sympto-map -- \
  psql -U postgres -d symptomap -c "SELECT 1;"

# Redis health check
kubectl exec -it redis-master-0 -n sympto-map -- redis-cli ping
```

## Maintenance

### Rolling Updates

```bash
# Update API image
kubectl set image deployment/sympto-map-api \
  api=symptomap/api:v1.1.0 -n sympto-map

# Monitor rollout
kubectl rollout status deployment/sympto-map-api -n sympto-map

# Rollback if needed
kubectl rollout undo deployment/sympto-map-api -n sympto-map
```

### Database Maintenance

```bash
# Run database vacuum
kubectl exec -it postgresql-0 -n sympto-map -- \
  psql -U postgres -d symptomap -c "VACUUM ANALYZE;"

# Update statistics
kubectl exec -it postgresql-0 -n sympto-map -- \
  psql -U postgres -d symptomap -c "ANALYZE;"
```

## CI/CD Integration

The deployment is automated through GitHub Actions. See `.github/workflows/ci-cd.yaml` for the complete pipeline.

### Manual Deployment

```bash
# Build and push images
docker build -t symptomap/api:latest -f Dockerfile.backend backend/
docker build -t symptomap/frontend:latest -f Dockerfile.frontend .

docker push symptomap/api:latest
docker push symptomap/frontend:latest

# Deploy
./scripts/deploy.sh production
```

## Support and Monitoring

- **Grafana Dashboard**: https://monitoring.symptomap.com
- **Prometheus Metrics**: https://prometheus.symptomap.com
- **Application Logs**: Use Kibana at https://logs.symptomap.com
- **Alerts**: Configured via AlertManager and Slack integration

For additional support, contact the DevOps team at devops@symptomap.com.
