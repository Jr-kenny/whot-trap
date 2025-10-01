# Whot Trap Project

A smart contract-based trap implementation connected to a public Whot game contract. This project demonstrates integration between a Whot game on the Ethereum Hoodi testnet and a custom trap that monitors game state and player activity.

## Overview

- **Whot Game Contract**: A deployed Whot game smart contract that manages players, games, and moves.
- **Trap Contract**: Monitors the Whot game contract and provides structured data to authorized operators.
- **Frontend**: Simple web interface to interact with the trap and display relevant game information.

## Features

- Real-time monitoring of Whot game activity.
- Ability to query game state, such as:
  - Number of active players
  - Last played moves
  - Game status (active/inactive)
- Trap configuration supports whitelisted operator addresses.
- Fully deployed on the Hoodi testnet.


This repository demonstrates how to integrate a Trap with a Whot game contract on Hoodi Ethereum.

It is designed to be used as a **reference template** for the Drosera team or community to replicate the setup.

## Quick Start

1. **Clone the repo**

```bash
git clone <repo-url>
cd drosera-whot
Install dependencies

bash
Copy code
bun install
Compile Contracts

bash
Copy code
forge build
Deploy Whot Game Contract (if not already deployed)

bash
Copy code
forge create src/WhotTrap.sol:WhotTrap --rpc-url <hoodi-rpc> --private-key <your-private-key> --broadcast
Deploy Trap Contract

bash
Copy code
forge create src/Trap.sol:Trap --rpc-url <hoodi-rpc> --private-key <your-private-key> --broadcast
Configure Trap

Edit drosera.toml (or equivalent) to point to your deployed WhotTrap and trap contract addresses, then set whitelisted operators:

toml
Copy code
[traps.whottrap]
path = "out/Trap.sol/Trap.json"
response_contract = "<WhotTrap_Contract_Address>"
response_function = "respondWithGameData(uint256)"
cooldown_period_blocks = 32
min_number_of_operators = 1
max_number_of_operators = 2
block_sample_size = 1
private_trap = true
whitelist = [
    "0x3AB368340a092480a870473fA453Aa818BeAeb5f",
    "0x26c1625785F9998A799c6a76F66391e6be9EE290"
]
Dry Run

Test that the trap is functioning:

bash
Copy code
drosera dryrun
Frontend (Optional)

The frontend/ folder contains a minimal interface.

To host locally:

bash
Copy code
cd frontend
bun dev
