#!/bin/bash
set -e

# SymptoMap Production Deployment Script

ENVIRONMENT=${1:-staging}
NAMESPACE="sympto-map-${ENVIRONMENT}"
CLUSTER_NAME="sympto-map-${ENVIRONMENT}"
REGION=${AWS_REGION:-us-west-2}

echo "🚀 Deploying SymptoMap to ${ENVIRONMENT}..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment. Use 'staging' or 'production'"
    exit 1
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Configure kubectl
echo "⚙️  Configuring kubectl..."
aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply Kubernetes manifests
echo "📦 Applying Kubernetes manifests..."

# Apply in order
kubectl apply -f kubernetes/namespace.yaml -n $NAMESPACE
kubectl apply -f kubernetes/configmap.yaml -n $NAMESPACE
kubectl apply -f kubernetes/secrets.yaml -n $NAMESPACE
kubectl apply -f kubernetes/service.yaml -n $NAMESPACE
kubectl apply -f kubernetes/deployment.yaml -n $NAMESPACE
kubectl apply -f kubernetes/ingress.yaml -n $NAMESPACE
kubectl apply -f kubernetes/hpa.yaml -n $NAMESPACE

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."

kubectl rollout status deployment/sympto-map-api -n $NAMESPACE --timeout=600s
kubectl rollout status deployment/sympto-map-frontend -n $NAMESPACE --timeout=600s

# Run health checks
echo "🏥 Running health checks..."

# Get service endpoints
API_ENDPOINT=$(kubectl get ingress sympto-map-ingress -n $NAMESPACE -o jsonpath='{.spec.rules[1].host}')
FRONTEND_ENDPOINT=$(kubectl get ingress sympto-map-ingress -n $NAMESPACE -o jsonpath='{.spec.rules[0].host}')

# Wait for DNS propagation
sleep 30

# Health check with retries
check_endpoint() {
    local url=$1
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Attempt $attempt: Checking $url"
        if curl -f -s "$url" > /dev/null; then
            echo "✅ $url is healthy"
            return 0
        fi
        echo "⚠️  Attempt $attempt failed, retrying..."
        sleep 10
        ((attempt++))
    done
    
    echo "❌ $url failed health check after $max_attempts attempts"
    return 1
}

# Check API health
if [ "$ENVIRONMENT" = "production" ]; then
    check_endpoint "https://$API_ENDPOINT/health"
    check_endpoint "https://$API_ENDPOINT/health/ready"
    check_endpoint "https://$FRONTEND_ENDPOINT"
else
    check_endpoint "https://$API_ENDPOINT/health"
    check_endpoint "https://$FRONTEND_ENDPOINT"
fi

# Display deployment info
echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📍 Endpoints:"
echo "   Frontend: https://$FRONTEND_ENDPOINT"
echo "   API: https://$API_ENDPOINT"
echo "   Health: https://$API_ENDPOINT/health"
echo ""
echo "🔧 Management commands:"
echo "   View pods: kubectl get pods -n $NAMESPACE"
echo "   View logs: kubectl logs -l app=sympto-map-api -n $NAMESPACE"
echo "   Scale API: kubectl scale deployment sympto-map-api --replicas=5 -n $NAMESPACE"
echo ""

# Production-specific checks
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔒 Production deployment completed"
    echo "⚠️  Remember to:"
    echo "   1. Update DNS records if needed"
    echo "   2. Verify SSL certificates"
    echo "   3. Check monitoring dashboards"
    echo "   4. Notify team of deployment"
fi

echo "✅ Deployment completed successfully!"
