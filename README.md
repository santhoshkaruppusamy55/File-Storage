# Manual Kind Deployment Guide

This guide explains how to deploy the "File Storage" project to a local Kubernetes Kind cluster manually (without Jenkins).

## Prerequisites
- **Docker** installed and running.
- **Kind** installed (`kind`).
- **kubectl** installed.

---

## Step 1: Create the Cluster
If you don't have a cluster yet, create one:
```bash
kind create cluster --name kind
```

## Step 2: Create Kubernetes Secrets
The application needs secrets for AWS and MySQL. Replace `xxx` and `yyy` with your actual credentials.

**AWS Secrets (for S3):**
```bash
kubectl create secret generic aws-secrets \
  --from-literal=AWS_ACCESS_KEY_ID=xxx \
  --from-literal=AWS_SECRET_ACCESS_KEY=yyy
```

**MySQL Secrets:**
```bash
kubectl create secret generic mysql-secrets \
  --from-literal=MYSQL_ROOT_PASSWORD=12345678 \
  --from-literal=MYSQL_DATABASE=file_storage \
  --from-literal=MYSQL_USER=root \
  --from-literal=MYSQL_PASSWORD=12345678
```

## Step 3: Apply Kubernetes Manifests
Apply all configuration files in the `k8s/` directory:
```bash
kubectl apply -f k8s/
```

## Step 4: Initialize the Database
Since it's a new cluster, you need to create the database tables:
```bash
# Wait for the mysql pod to be 'Running' before running this:
kubectl exec -i deployment/mysql -- mysql -u root -p12345678 file_storage < backend/models/schema.sql
```

## Step 5: Access the Application
Use `port-forward` to access the services from your laptop:

**Frontend (available at http://localhost:8000):**
```bash
kubectl port-forward service/frontend 8000:80
```

**Backend (API available at http://localhost:5000):**
```bash
kubectl port-forward service/backend 5000:5000
```

---

## Note on Images
The manifests in `k8s/` use the following images from Docker Hub:
- **Frontend**: `santhoshkaruppusamy/file-storage-frontend:latest`
- **Backend**: `santhoshkaruppusamy/file-storage-backend:latest`

If you make changes to your code, you must rebuild the images using Docker and push them to Docker Hub (or load them directly into Kind using `kind load docker-image`).
