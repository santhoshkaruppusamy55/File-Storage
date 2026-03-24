pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'santhoshkaruppusamy'
        FRONTEND_IMAGE = "${DOCKER_HUB_USER}/file-storage-frontend"
        BACKEND_IMAGE = "${DOCKER_HUB_USER}/file-storage-backend"
        DOCKER_HUB_CREDENTIALS_ID = 'docker-hub-credentials'
        KUBECONFIG_CREDENTIALS_ID = 'kubeconfig-credentials'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Images') {
            steps {
                script {
                    echo "Building Frontend Image..."
                    sh "docker build -t ${FRONTEND_IMAGE}:latest ./frontend"
                    
                    echo "Building Backend Image..."
                    sh "docker build -t ${BACKEND_IMAGE}:latest ./backend"
                }
            }
        }

        stage('Push Images') {
            steps {
                script {
                    docker.withRegistry('', DOCKER_HUB_CREDENTIALS_ID) {
                        echo "Pushing Frontend Image..."
                        sh "docker push ${FRONTEND_IMAGE}:latest"
                        
                        echo "Pushing Backend Image..."
                        sh "docker push ${BACKEND_IMAGE}:latest"
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withKubeConfig([credentialsId: KUBECONFIG_CREDENTIALS_ID]) {
                    echo "Deploying to Kubernetes..."
                    sh "kubectl apply -f k8s/mysql.yaml"
                    sh "kubectl apply -f k8s/redis.yaml"
                    sh "kubectl apply -f k8s/backend.yaml"
                    sh "kubectl apply -f k8s/frontend.yaml"
                    
                    echo "Verifying Deployment..."
                    sh "kubectl rollout status deployment/backend"
                    sh "kubectl rollout status deployment/frontend"
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed!'
        }
    }
}
