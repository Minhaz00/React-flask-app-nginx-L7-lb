# AWS infra with Pulumi, Installation of K3s and Nginx layer 7 load balancing on React-flask Application

In this lab, we will set up a lightweight Kubernetes environment using `K3s` on an AWS EC2 instance. Following the installation, we will configure Nginx as a `Layer 7 load balancer` to manage traffic to worker nodes. The services will be exposed using Kubernetes NodePort, allowing external access through Nginx.

![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-7.png?raw=true)

## Task description
### These are the task we will perform in this lab:

1. Create AWS infrastructure using PULUMI
2. Create a simple flask server, build image, push to docker hub
3. Create a simple react app, build image, push to docker hub
4. Configure SSH config file for SSHing into the servers
5. Install and configure k3s and worker nodes
6. Deploy the react-app and flask-server in k3s cluster
7. Install and configure nginx as layer 7 load balancer
8. Set DNS hosts name in local machine (linux)
9. Test the load balancer to ensure it is working correctly



## Step by step guide

## Step 1: Create AWS infrastructure using PULUMI

For this project, we need an instance for NGINX, and three instance for k3s (master-instance, worker1-instance, worker2-instance) and other necessary resouces.

![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-6.jpg?raw=true)

### Configure AWS CLI

- Configure AWS CLI with the necessary credentials. Run the following command and follow the prompts to configure it:

    ```sh
    aws configure
    ```
    
    This command sets up your AWS CLI with the necessary credentials, region, and output format.

    ![](https://github.com/Konami33/poridhi.io.intern/blob/main/PULUMI/PULUMI%20js/Lab-3/images/5.png?raw=true)

    You will find the `AWS Access key` and `AWS Seceret Access key` on Lab description page,where you generated the credentials

    ![](https://github.com/Konami33/poridhi.io.intern/blob/main/PULUMI/PULUMI%20js/Lab-3/images/6.png?raw=true)


### Set Up a Pulumi Project

1. **Set Up a Pulumi Project**:
- Create a new directory for your project and navigate into it:
    ```sh
    mkdir aws-k3s-infra
    cd aws-k3s-infra
    ```

2. **Initialize a New Pulumi Project**:
- Run the following command to create a new Pulumi project:

    ```sh
    pulumi new aws-python
    ```
    Follow the prompts to set up your project.

3. **Create Key Pair:**:

- Create a new key pair for our instances using the following command:

    ```sh
    aws ec2 create-key-pair --key-name MyKeyPair --query 'KeyMaterial' --output text > MyKeyPair.pem
    ```

    These commands will create key pair for nginx instance and for k3s cluster(master, worker1, worker2)

4. **Set File Permissions of the key files**:

- **For Linux**:
    ```sh
    chmod 400 MyKeyPair.pem
    ```

### Write Code for infrastructure creation

1. **Open `__main__.py` file in your project directory**:

    ```python
    import pulumi
    import pulumi_aws as aws

    # Create a VPC
    vpc = aws.ec2.Vpc("my-vpc",
        cidr_block="10.0.0.0/16",
        tags={
            "Name": "my-vpc",
        })

    pulumi.export("vpcId", vpc.id)

    # Create a public subnet
    public_subnet = aws.ec2.Subnet("public-subnet",
        vpc_id=vpc.id,
        cidr_block="10.0.1.0/24",
        availability_zone="ap-southeast-1a",
        map_public_ip_on_launch=True,
        tags={
            "Name": "public-subnet",
        })

    pulumi.export("publicSubnetId", public_subnet.id)

    # Create an Internet Gateway
    igw = aws.ec2.InternetGateway("internet-gateway",
        vpc_id=vpc.id,
        tags={
            "Name": "igw",
        })

    pulumi.export("igwId", igw.id)

    # Create a route table
    public_route_table = aws.ec2.RouteTable("public-route-table",
        vpc_id=vpc.id,
        tags={
            "Name": "rt-public",
        })

    pulumi.export("publicRouteTableId", public_route_table.id)

    # Create a route in the route table for the Internet Gateway
    route = aws.ec2.Route("igw-route",
        route_table_id=public_route_table.id,
        destination_cidr_block="0.0.0.0/0",
        gateway_id=igw.id)

    # Associate the route table with the public subnet
    route_table_association = aws.ec2.RouteTableAssociation("public-route-table-association",
        subnet_id=public_subnet.id,
        route_table_id=public_route_table.id)

    # Create a security group for the public instance
    public_security_group = aws.ec2.SecurityGroup("public-secgrp",
        vpc_id=vpc.id,
        description="Enable HTTP and SSH access for public instance",
        ingress=[
            {"protocol": "-1", "from_port": 0, "to_port": 0, "cidr_blocks": ["0.0.0.0/0"]},
        ],
        egress=[
            {"protocol": "-1", "from_port": 0, "to_port": 0, "cidr_blocks": ["0.0.0.0/0"]},
        ])

    # Use the specified Ubuntu 24.04 LTS AMI
    ami_id = "ami-060e277c0d4cce553"

    # Create nginx instance
    nginx_instance = aws.ec2.Instance("nginx-instance",
        instance_type="t2.micro",
        vpc_security_group_ids=[public_security_group.id],
        ami=ami_id,
        subnet_id=public_subnet.id,
        key_name="MyKeyPair",
        associate_public_ip_address=True,
        tags={
            "Name": "nginx-lb",
        })

    pulumi.export("publicInstanceId", nginx_instance.id)
    pulumi.export("publicInstanceIp", nginx_instance.public_ip)

    # Create master instance
    master_instance = aws.ec2.Instance("master-instance",
        instance_type="t3.small",
        vpc_security_group_ids=[public_security_group.id],
        ami=ami_id,
        subnet_id=public_subnet.id,
        key_name="MyKeyPair",
        associate_public_ip_address=True,
        tags={
            "Name": "master",
        })

    pulumi.export("masterInstanceId", master_instance.id)
    pulumi.export("masterInstanceIp", master_instance.public_ip)

    # Create worker1 instance
    worker1_instance = aws.ec2.Instance("worker1-instance",
        instance_type="t3.small",
        vpc_security_group_ids=[public_security_group.id],
        ami=ami_id,
        subnet_id=public_subnet.id,
        key_name="MyKeyPair",
        associate_public_ip_address=True,
        tags={
            "Name": "worker1",
        })

    pulumi.export("worker1InstanceId", worker1_instance.id)
    pulumi.export("worker1InstanceIp", worker1_instance.public_ip)

    # Create worker2 instance
    worker2_instance = aws.ec2.Instance("worker2-instance",
        instance_type="t3.small",
        vpc_security_group_ids=[public_security_group.id],
        ami=ami_id,
        subnet_id=public_subnet.id,
        key_name="MyKeyPair",
        associate_public_ip_address=True,
        tags={
            "Name": "worker2",
        })

    pulumi.export("worker2InstanceId", worker2_instance.id)
    pulumi.export("worker2InstanceIp", worker2_instance.public_ip)
    ```

    **NOTE:** Update the security group *inbound rules* accordingly to your requirement. But for now it is set up to allow all traffic from all sources. You can change it later. 

### Deploy the Pulumi Stack

1. **Deploy the stack**:

    ```sh
    pulumi up
    ```
    Review the changes and confirm by typing "yes".

### Verify the Deployment

You can varify the creteated resources such as VPC, Subnet, EC2 instance using AWS console.

## Step 2: Create a simple flask server, build image, push to docker hub

### Create a directory in your **local machine** (e.g., flask-server)

```sh
mkdir backend
cd backend
```
### Create a file `app.py`

Create `app.py` in the `backend` directory and edit as follows:

```sh
from flask import Flask, jsonify
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def hello_world():
    return jsonify({"message": "Hello world!"})

@app.route('/api/message', methods=['GET'])
def get_message():
    return jsonify({"message": "Hello from Flask API server!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### Create the `Dockerfile`

```sh
# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages
RUN pip install Flask flask-cors

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV FLASK_APP=app.py

# Run app.py when the container launches
CMD ["python", "app.py"]

```

### Build and push the image to docker hub
Use the following commands to build the docker image for React app and push the image to dockerhub repository.

```sh
docker build -t my-flask-api .
docker tag my-flask-api:latest <your-docker-hub-username>/my-flask-api
docker push <your-docker-hub-username>/my-flask-api
```

## Step 3: Create a simple react app, build image, push to docker hub

### Create a simple react app
Use the following command to create a react app locally:

```bash
npx create-react-app frontend .
```

### Edit `app.js` file:

```js
import React, { useState, useEffect } from 'react';


function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    
   const apiUrl = process.env.REACT_APP_API_URL;
    fetch(`${apiUrl}/api/message`)
      .then(response => response.json())
      .then(data => {
        setMessage(data.message);
      })
      .catch(error => {
        console.error('Error fetching the message:', error);
      });
  }, []);

  return (
    <div className="App">
      <h3>Message from Flask API:</h3>
      <h3>{message}</h3>
    </div>
  );
}

export default App;
```

This app sends a request to the server and displays the message from the server.

### Create a `.env` file

Create a `.env` file in the root folder of your application for the flask server URL.

```
REACT_APP_API_URL=http://localhost:5000
```

### Create the `Dockerfile`

```Dockerfile
# Use an official Node.js runtime as a parent image
FROM node:16-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the .env file
COPY .env .env

# Expose the port the app runs on
EXPOSE 3000

# Start the React app
CMD ["npm", "start"]
```

### Build and push the image to docker hub

Use the following commands to build the docker image for React app and push the image to dockerhub repository.

```sh
docker build -t my-react-app .
docker tag my-react-app:latest <your-docker-hub-username>/my-react-app
docker push <your-docker-hub-username>/my-react-app
```


## Step 4: Configure SSH config file for SSHing into the servers
In this `~/.ssh/` directory, create a `config` file:

```bash
vim ~/.ssh/config
```

Edit the file that simplifies the SSH process for this scenario:

```sh
Host nginx
    HostName <nginx-public-ip>
    User ubuntu
    IdentityFile /root/code/aws-k3s-infra/MyKeyPair.pem

Host master
    HostName <master-ip>
    User ubuntu
    IdentityFile /root/code/aws-k3s-infra/MyKeyPair.pem

Host worker1
    HostName <worker1-ip>
    User ubuntu
    IdentityFile /root/code/aws-k3s-infra/MyKeyPair.pem

Host worker2
    HostName <worker2-ip>
    User ubuntu
    IdentityFile /root/code/aws-k3s-infra/MyKeyPair.pem
```

**Explanation of the Config File:**

- `Host:` This section defines the connection to your server. The HostName is the public/private IP of the server
- `User:` **Ubuntu** by default if your have launched an ubuntu instance. Change accordingly to your requirement.
- `IdentityFile:` specifies the private key used for authentication. Change the location of your key file accordingly.

### Test SSH connection

- From local machine SSH into nginx instance:

    ```sh
    ssh nginx
    ```

- From local SSH into master instance:

    ```sh
    ssh master
    ```

- From local SSH into worker1 instance:

    ```sh
    ssh worker1
    ```
- From local SSH into worker2 instance:

    ```sh
    ssh worker2
    ```

### Set hostname

You can also set the hostname of the instances by run these commands

- Nginx instance

    ```sh
    sudo hostnamectl set-hostname nginx
    ```

- Master instance

    ```sh
    sudo hostnamectl set-hostname master
    ```

- Worker1 instance

    ```sh
    sudo hostnamectl set-hostname worker1
    ```

- Worker2 instance

    ```sh
    sudo hostnamectl set-hostname worker2
    ```

After this command, exit the terminal and again ssh into the servers to check if the hostname is setup correctly.

## Step 5: Install and configure k3s and worker nodes

### Install k3s on Master Node:

- SSH into master node and run the following command to install k3s:

    ```bash
    curl -sfL https://get.k3s.io | sh -
    ```

- After installation, the master node should become the **control plane** for your Kubernetes cluster.

    ![alt text](https://github.com/Konami33/Nginx-load-balancer/raw/main/img/image-5.png?raw=true)

### Join Worker Nodes to the Cluster:

- Retrieve the token from the master node to join worker nodes:

    ```bash
    sudo cat /var/lib/rancher/k3s/server/node-token
    ```
    ![alt text](https://github.com/Konami33/Nginx-load-balancer/raw/main/img/image-15.png?raw=true)

- Copy the token.

- SSH into **each worker node** and run the following command to join it to the cluster (Remember to replace `<master-ip>` with the private IP of the master node and `<token>` with the token obtained earlier):

    ```bash
    curl -sfL https://get.k3s.io | K3S_URL=https://<master-ip>:6443 K3S_TOKEN=<token> sh -
    ```

- Check the status of k3s-agent

    ![alt text](https://github.com/Konami33/Nginx-load-balancer/raw/main/img/image-6.png?raw=true)

### Verify Cluster Setup

- SSH into the master node and set the permission.

    ```sh
    sudo chmod 644 /etc/rancher/k3s/k3s.yaml
    ```
- Run this command to verify all nodes

    ```bash
    kubectl get nodes
    ```

- You should see the master node and both worker nodes listed as ready.

    ![alt text](https://github.com/Konami33/Nginx-load-balancer/raw/main/img/image-7.png?raw=true)


## Step 6: Deploy the servers in k3s cluster.

### SSH into the master node and create manifest directory

SSH into Master instance and Create a directory (e.g., *manifest*)

```sh
mkdir manifest
cd manifest
```
 
### Create manifest for flask server
Create manifest file for flask deployment (e.g., `flask-app-deploy.yml`) using `vim flask-app-deploy.yml` command and edit as follows:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flask-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flask-app
  template:
    metadata:
      labels:
        app: flask-app
    spec:
      containers:
      - name: flask-app
        image: minhaz71/my-flask-api:latest
        ports:
        - containerPort: 5000
      nodeSelector:
        role: worker-node


---
apiVersion: v1
kind: Service
metadata:
  name: flask-app-service
spec:
  type: NodePort
  selector:
    app: flask-app
  ports:
    - protocol: TCP
      port: 5000
      targetPort: 5000
      nodePort: 30001
```
With this configuration, k3s will schedule your pods on nodes with the label role=worker-node, which in this case are worker1 and worker2.

### Create manifest for react app
Create manifest file for react app deployment (e.g., `react-app-deploy.yml`) using `vim react-app-deploy.yml` command and edit as follows:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: react-app
  template:
    metadata:
      labels:
        app: react-app
    spec:
      containers:
      - name: react-app
        image: minhaz71/my-react-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: REACT_APP_API_URL
          value: "http://<master-node-IP>:<Flask-App-NodePort>"  # Edit with your master IP and NodePort of your flask app service  
      nodeSelector:
        role: worker-node    

---
apiVersion: v1
kind: Service
metadata:
  name: react-app-service
spec:
  type: NodePort
  selector:
    app: react-app
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
      nodePort: 30002
```


With this configuration, **k3s** will schedule your pods on nodes with the label `role=worker-node`, which in this case are worker1 and worker2.

### Label Your Worker Nodes
We need to label both worker nodes as we want to deploy the flask server in both the worker nodes.

- Label worker-node-1:

    ```bash
    kubectl label nodes <worker-node-1> role=worker-node
    ```
- Label worker-node-2:

    ```bash
    kubectl label nodes <worker-node-2> role=worker-node
    ```
    ![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-2.png?raw=true)

    **NOTE:** Make sure to replace with your worker node name.

### Deploy the flask Server and react application

- Apply the manifests file

    ```sh
    kubectl apply -f flask-app-deploy.yml
    kubectl apply -f react-app-deploy.yml
    ```

- Check the created resources

    ```sh
    kubectl get all
    ```

    ![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-1.png?raw=true)

You can see the created pods, deployemt and service. Make sure all are in the running state.

## Step 7: Install and configure nginx as layer 7 load balancer

Now, connect to the `Nginx instance` and create a `nginx.conf` file and a `Dockerfile`. 

### Install Docker

Install docker using the following commands and check the docker version:

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update && sudo apt install -y docker-ce

sudo usermod -aG docker ${USER} && sudo chmod 666 /var/run/docker.sock

docker --version
```

### Configure Nginx

Create a directory (e.g., `Nginx`)
```bash
mkdir Nginx
cd Nginx
```

Create `nginx.conf` in the Nginx directory with the following configuration:

```nginx
events {}

http {
    upstream react_app {
        server <worker1_ip>:<nodeport_react>; # Replace with actual worker1 IP and NodePort for React
        server <worker2_ip>:<nodeport_react>; # Replace with actual worker2 IP and NodePort for React
    }

    upstream flask_api {
        server <worker1_ip>:<nodeport_flask>; # Replace with actual worker1 IP and NodePort for Flask
        server <worker2_ip>:<nodeport_flask>; # Replace with actual worker2 IP and NodePort for Flask
    }

    server {
        listen 80;
        server_name food-fe.poridhi.io;

        location / {
            proxy_pass http://react_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    server {
        listen 80;
        server_name food-api.poridhi.io;

        location / {
            proxy_pass http://flask_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}

```

**NOTE**: Make sure to change the ip and nodeport accordingly.

### Create a Dockerfile

```Dockerfile
FROM nginx:latest
COPY nginx.conf /etc/nginx/nginx.conf
```

### Build Nginx Docker Image

```bash
docker build -t custom-nginx .
```
This command builds a Docker image for Nginx with our custom configuration.

### Run the Nginx Docker image

```bash
docker run -d -p 80:80 --name my_nginx custom-nginx
```

This command starts the Nginx container with our custom configuration.


## Step 8: Set DNS hosts name in local machine (linux)


To map IP addresses to domain names on a local linux system, you can edit the `/etc/hosts` file. This file allows you to specify which domain names should resolve to specific IP addresses.


### Open the `/etc/hosts` file

Use a text editor like nano to open the file. You will need root privileges to modify this file.

```bash
sudo nano /etc/hosts
```

### Add the IP addresses and domain mappings

Scroll to the end of the file and add your IP addresses and corresponding domain names. Each entry should be on a new line, with the IP address first, followed by the domain name(s) you want to map to that IP.

```bash
<nginx-public-IP> http://food-fe.poridhi.io
<nginx-public-IP> http://food-api.poridhi.io
```


Replace `<nginx-public-IP>` with your nginx instance public IP. **http://food-fe.poridhi.io** and **http://food-api.poridhi.io**: The domain names you want to resolve to the specified IP address.

![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-3.jpg?raw=true)

After adding your entries, save the file and exit the editor.
Now, your Linux system will resolve `food-fe.poridhi.io` and `food-api.poridhi.io` to `<nginx-public-IP>` as specified in the `/etc/hosts` file.






## Step 9: Test the load balancer

Now open the domain names in the browser to see the react app and flask server through the nginx layer 7 load balancer.

![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-4.jpg?raw=true)

![alt text](https://github.com/Minhaz00/React-flask-app-nginx-L7-lb/blob/main/images/image-5.jpg?raw=true)

## Conclusion

So, we have completed our task successfully. We have created the infrastrucure using pulumi, installed and configure k3s and deployed the react app and flask servers in the k3s cluster. Then configured a layer 7 loadbalancer using nginx. We also setup the DNS host names in local machine (linux) for the react app as well as the flask server.
