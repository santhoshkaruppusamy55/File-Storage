# Automated Jenkins Deployment Guide

This guide explains how to set up and use the Jenkins pipeline to automate the build, push, and deployment of the "File Storage" project to your local Kubernetes Kind cluster.

## 1. Prerequisites
- **Jenkins** installed and running on `localhost:8080`.
- **Docker** installed and configured for the `jenkins` user.(`sudo usermod -aG docker jenkins`)
- **Kind** installed and a cluster created (`kind create cluster --name kind`).
- **Github Repository** with your code pushed.

## 2. Install Required Jenkins Plugins
Go to **Manage Jenkins** > **Plugins** > **Available Plugins** and install:
- **Docker Pipeline**
- **Kubernetes CLI**

## 3. Configure Credentials in Jenkins
Go to **Manage Jenkins** > **Credentials** > **System** > **Global credentials** and add:

### A. Docker Hub Credentials
- **Kind**: Username with password
- **ID**: `docker-hub-credentials`
- **Username**: Your Docker Hub username.
- **Password**: Your Docker Hub password or Personal Access Token.

### B. Kubernetes Credentials (Kubeconfig)
1. Generate the config file:
   ```bash
   kind get kubeconfig --name kind > kind-config-jenkins.yaml
   ```
2. In Jenkins, click **Add Credentials**:
   - **Kind**: Secret file
   - **ID**: `kubeconfig-credentials`
   - **File**: Upload the `kind-config-jenkins.yaml` you just created.

## 4. Create the Pipeline Job
1. From the Jenkins Dashboard, click **New Item**.
2. Enter name: `file-storage-pipeline`, select **Pipeline**, and click **OK**.
3. In the **Pipeline** section:
   - **Definition**: Select "Pipeline script from SCM"
   - **SCM**: Select **Git**
   - **Repository URL**: `https://github.com/santhoshkaruppusamy55/File-Storage.git`
   - **Branch Specifier**: `*/main`
   - **Script Path**: `Jenkinsfile`
4. Click **Save**.

## 5. Security & Manual Steps (Crucial)
Since we keep secrets out of Git, you must perform these steps **manually** in your new cluster:

### Create AWS & MySQL Secrets:
```bash
# AWS Secrets
kubectl create secret generic aws-secrets \
  --from-literal=AWS_ACCESS_KEY_ID=xxx \
  --from-literal=AWS_SECRET_ACCESS_KEY=yyy

# MySQL Secrets(use the password you want) 
kubectl create secret generic mysql-secrets \
  --from-literal=MYSQL_ROOT_PASSWORD=12345678 \
  --from-literal=MYSQL_DATABASE=file_storage \
  --from-literal=MYSQL_USER=root \
  --from-literal=MYSQL_PASSWORD=12345678
```

### Initialize Database (First Run Only):
```bash
kubectl exec -i deployment/mysql -- mysql -u root -p12345678 file_storage < backend/models/schema.sql
```

## 6. Access your App
Once the Jenkins build is successful, use port-forwarding to access the app:
- **Frontend**: `kubectl port-forward service/frontend 8000:80` (Visit http://localhost:8000)
- **Backend**: `kubectl port-forward service/backend 5000:5000`
