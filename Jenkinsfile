def getArtifactoryPort() {
  if (GIT_BRANCH ==~ /release-.*/) {
    return "16003"
  } else if (GIT_BRANCH ==~ /staging/) {
    return "16002"
  } else {
    return "16001"
  }
}

pipeline {
  options {
    disableConcurrentBuilds()
  }
  agent {
    label 'CAE-Jenkins2-DH-Agents-Linux'
  }
  environment {
    ARTIFACTORY_URL = "artifactory.jpl.nasa.gov:${getArtifactoryPort()}"
    DOCKER_GATEWAY_ARTIFACTORY = "${ARTIFACTORY_URL}/gov/nasa/jpl/aerie/aerie-gateway:${GIT_BRANCH}"
    NODE_LTS_IMAGE = "artifactory.jpl.nasa.gov:17001/node:lts-alpine"
  }
  stages {
    stage('Docker') {
      agent {
        docker {
          alwaysPull true
          args '-u root --mount type=bind,source=${WORKSPACE},target=/home --workdir=/home -v /var/run/docker.sock:/var/run/docker.sock'
          image 'gov/nasa/jpl/aerie/jenkins/aerie-node:latest'
          registryCredentialsId 'Artifactory-credential'
          registryUrl 'https://artifactory.jpl.nasa.gov:16001'
          reuseNode true
        }
      }
      stages {
        stage ('Build') {
          steps {
            withCredentials([
              usernamePassword(
                credentialsId: '34c6de8f-197d-46e5-aeb3-2153697dcb9c',
                passwordVariable: 'NPM_PASSWORD',
                usernameVariable: 'NPM_EMAIL'
              )
            ]) {
              sh '''
                # Install dependencies and build
                npm install --silent
                npm run build
                rm -rf node_modules
                npm install --only=production --silent

                # Build Docker image
                docker build -t ${DOCKER_GATEWAY_ARTIFACTORY} --build-arg NODE_LTS_IMAGE=${NODE_LTS_IMAGE} --rm .
              '''
            }
          }
        }
        stage ('Publish to Artifactory') {
          when {
            expression { GIT_BRANCH ==~ /(develop|staging|release-.*)/ }
          }
          steps {
            withCredentials([
              usernamePassword(
                credentialsId: '9db65bd3-f8f0-4de0-b344-449ae2782b86',
                passwordVariable: 'DOCKER_LOGIN_PASSWORD',
                usernameVariable: 'DOCKER_LOGIN_USERNAME'
              )
            ]) {
              sh '''
                echo ${DOCKER_LOGIN_PASSWORD} | docker login -u ${DOCKER_LOGIN_USERNAME} ${ARTIFACTORY_URL} --password-stdin
                docker push ${DOCKER_GATEWAY_ARTIFACTORY}
                docker logout ${ARTIFACTORY_URL}
              '''
            }
          }
        }
      }
      post {
        always {
          sh '''
            docker rmi ${DOCKER_GATEWAY_ARTIFACTORY} --force
          '''
        }
        cleanup {
          cleanWs()
          deleteDir()
        }
      }
    }
  }
}
