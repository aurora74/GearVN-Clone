#!/bin/bash

# Benchmark Script for URL Shortener

# 1. Read Stress Test (Ramp Up)
echo "======================================"
echo "Starting READ Performance Benchmark..."
echo "======================================"

for rate in 1000 2000 5000 8000
do
    echo "[READ] Running at $rate Req/s..."
    vegeta attack -targets=attack_targets.txt -duration=10s -rate=$rate | vegeta report
    echo "--------------------------------------"
    sleep 2
done

# 2. Write Stress Test (Ramp Up)
echo "======================================"
echo "Starting WRITE Performance Benchmark..."
echo "======================================"

# Ensure targets exist
if [ ! -f write_targets.json ]; then
    echo "Generating write targets..."
    ./venv/bin/python testscripts/write_target_gen.py
fi

for rate in 100 500 1000 2000
do
    echo "[WRITE] Running at $rate Req/s..."
    # inputs are in JSON format
    vegeta attack -format=json -targets=write_targets.json -duration=10s -rate=$rate | vegeta report
    echo "--------------------------------------"
    sleep 2
done

echo "Benchmark Complete."
