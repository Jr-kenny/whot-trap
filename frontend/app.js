import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

const CONTRACT_ADDRESS = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D"; // your deployed Whot contract
const ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "games",
    "outputs": [
      { "internalType": "address", "name": "creator", "type": "address" },
      { "internalType": "uint8", "name": "playersJoined", "type": "uint8" },
      { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" },
      { "internalType": "bool", "name": "started", "type": "bool" },
      { "internalType": "bool", "name": "ended", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "gameCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

let provider, contract;

async function init() {
  provider = new ethers.JsonRpcProvider("https://rpc.hoodi.xyz"); // replace with correct Hoodi RPC
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  loadGames();
}

async function loadGames() {
  try {
    const count = await contract.gameCount();
    const total = Number(count);

    const gamesContainer = document.getElementById("games");
    gamesContainer.innerHTML = "";

    for (let i = 1; i <= total; i++) {
      const game = await contract.games(i);

      const div = document.createElement("div");
      div.className = "game-card";
      div.innerHTML = `
        <h3>Game #${i}</h3>
        <p><b>Creator:</b> ${game.creator}</p>
        <p><b>Players Joined:</b> ${game.playersJoined}/${game.maxPlayers}</p>
        <p><b>Status:</b> ${game.started ? (game.ended ? "Ended" : "Ongoing") : "Not Started"}</p>
      `;
      gamesContainer.appendChild(div);
    }
  } catch (err) {
    console.error("loadGame err:", err);
  }
}

init();
