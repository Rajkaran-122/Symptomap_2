-- Drop existing user and database if they exist
DROP DATABASE IF EXISTS symptomap;
DROP USER IF EXISTS symptomap;

-- Create symptomap user with password
CREATE USER symptomap WITH PASSWORD 'password';

-- Create symptomap database
CREATE DATABASE symptomap OWNER symptomap;

-- Grant privileges
ALTER ROLE symptomap SET client_encoding TO 'utf8';
ALTER ROLE symptomap SET default_transaction_isolation TO 'read committed';
ALTER ROLE symptomap SET default_transaction_deferrable TO on;
ALTER ROLE symptomap SET default_transaction_read_only TO off;

-- Grant schema privileges
GRANT ALL PRIVILEGES ON SCHEMA public TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO symptomap;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO symptomap;
