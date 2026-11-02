#!/bin/bash
# One-time setup of a fresh Oracle Ubuntu 24.04 server (ARM or x86).
# Run as the default "ubuntu" user:  bash install.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== Installing Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "== Opening the firewall (Oracle images block everything but SSH by default)"
for rule in "tcp 80" "tcp 443" "udp 443" "tcp 1935" "udp 8189" "tcp 8189"; do
  set -- $rule
  sudo iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p "$1" --dport "$2" -j ACCEPT
done
sudo apt-get install -y iptables-persistent >/dev/null && sudo netfilter-persistent save
echo "   Also open the same ports in Oracle: Networking → Virtual cloud network → Security list → Ingress rules."

echo "== Folders"
mkdir -p data/postgres data/storage data/recordings data/uploads data/backups data/caddy
sudo chown -R 1000:1000 data/recordings data/uploads

[ -f .env ] || { cp .env.example .env; echo "   Fill in .env, then run this again."; exit 0; }
[ -f app.env ] || { cp app.env.example app.env; echo "   Fill in app.env, then run this again."; exit 0; }

echo "== Starting (the first build takes ~10 minutes)"
sudo docker compose --env-file .env up -d --build
sudo docker compose ps
echo "Done. Open https://$(grep ^APP_DOMAIN= .env | cut -d= -f2)"
