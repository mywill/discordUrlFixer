#!/bin/bash
set -e

apt-get update && apt-get install -y --no-install-recommends \
  curl \
  git \
  ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
