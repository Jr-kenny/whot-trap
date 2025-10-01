import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.0/+esm";

const WHOT_CONTRACT = "0x68c7a00A968Ba627921CD2885ac906DF56F96ABb";
const TRAP_CONTRACT = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D";
const RPC_URL = "https://ethereum-hoodi-rpc.publicnode.com";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Minimal ABI just to fetch game info
const whotAbi = [
  "function nextGameId() view returns (uint256)",
  "function games(uint256) view returns (uint256 id, address creator, uint8 playersJoined, uint8 totalPlayers, bool started, bool finished, bool someFlag1, bool someFlag2, bytes lastCard, uint8 someSuit, uint16 someVal, uint8 lastMove, uint256 timestamp)"
];

const trapAbi = [
  "function collect() view returns (bytes memory)",
  "function shouldRespond(bytes[] calldata data) view returns (bool, bytes memory)"
];

const whotGame = new ethers.Contract(WHOT_CONTRACT, whotAbi, provider);
const trap = new ethers.Contract(TRAP_CONTRACT, trapAbi, provider);

// Utility: update DOM safely
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function fetchData() {
  try {
    // --- Fetch game info ---
    const nextId = await whotGame.nextGameId();
    const gameId = nextId > 0 ? nextId - 1n : 0n; // handle underflow
    const gameData = await whotGame.games(gameId);

    setText("game-id", `Game ID: ${gameId}`);
    setText("players", `Players Joined: ${gameData.playersJoined}`);
    setText("status", `Status: ${gameData.started ? "Started" : "Waiting"}`);

    // --- Fetch trap info ---
    const collected = await trap.collect();
    // decode as (uint256, uint8, address)
    const [id, players, creator] = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint256", "uint8", "address"],
      collected
    );

    // Example logic: trap is "active" if players > 0
    const active = players > 0;
    setText("trap-active", `Active: ${active}`);
    setText("trap-response", `Response: Game ${id}, Players ${players}, Creator ${creator}`);

  } catch (err) {
    console.error("Error fetching data:", err);
    setText("game-id", "Error loading data");
    setText("players", "—");
    setText("status", "—");
    setText("trap-active", "—");
    setText("trap-response", "—");
  }
}

document.getElementById("refresh").addEventListener("click", fetchData);

// Initial load
fetchData();
