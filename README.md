# Whot Trap
i created a trad game called whot on the hoodi testnet every rules is hosted on its contract " 0x68c7a00A968Ba627921CD2885ac906DF56F96ABb"
i then designed and implemented whot trap " 0xd5dcdfb129baf1ae2a2b73252202a03aedf9006d", a custom Drosera Trap contract tailored to the whot game 
its functions are like admins, it enforces game-specific rules and fairness at the smart contract layer, making sure no participant can bypass the rules even if the frontend is compromised.

How it Works

Rule Enforcement: WhotTrap intercepts all player actions (e.g., starting a game, playing a card, drawing) and validates them against the whot game official rules.

Turn Validation: It makes sure that players only move during their turn, eliminating the risk of double moves or skipping.

Card Logic: kinda enforces card-matching rules (number or shape), and special card effects (e.g., “Pick Two”, “Hold On”, “Suspension”).

Game Integrity: Any action that violates the games rules is automatically rejected, preserving fairness.

so its basically a refreee for the game 

```bash
[traps.whottrap]
path = "out/Trap.sol/Trap.json"
response_contract = "<WhotTrap_Contract_Address>"
response_function = "respondWithGameData(uint256)"
cooldown_period_blocks = 32
min_number_of_operators = 1
max_number_of_operators = 2
block_sample_size = 1
private_trap = true
whitelist = []
```
