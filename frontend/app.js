import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

const CONTRACT_ADDRESS = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D"; // deployed WhotTrap
const ABI = [
  "function games(uint256) view returns (uint256 id, address creator, uint8 playersJoined, uint8 maxPlayers, bool active)"
];

// Hoodi Testnet details
const HOODI_CHAIN_ID = "0x88D70"; // hex of 560048
const HOODI_PARAMS = {
  chainId: HOODI_CHAIN_ID,
  chainName: "Ethereum Hoodi Testnet",
  rpcUrls: ["https://ethereum-hoodi-rpc.publicnode.com"],
  nativeCurrency: {
    name: "HoodiETH",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorerUrls: ["https://hoodi.etherscan.io"],
};

let provider, signer, whot;

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask not found! Install it to continue.");
    return;
  }

  // Switch/Add Hoodi network
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HOODI_CHAIN_ID }],
    });
  } catch (switchError) {
    // Add if missing
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [HOODI_PARAMS],
      });
    } else {
      console.error("Switch network error:", switchError);
      return;
    }
  }

  // Request accounts
  await window.ethereum.request({ method: "eth_requestAccounts" });

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  whot = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  console.log("Wallet connected:", await signer.getAddress());
  loadGames();
}

async function loadGames() {
  try {
    const container = document.getElementById("games");
    container.innerHTML = "";

    for (let i = 0; i < 5; i++) {
      try {
        const game = await whot.games(i);
        if (game.active) {
          const div = document.createElement("div");
          div.className = "game-card";
          div.innerHTML = `
            <h3>Game #${game.id}</h3>
            <p>Creator: ${game.creator}</p>
            <p>Players: ${game.playersJoined}/${game.maxPlayers}</p>
          `;
          container.appendChild(div);
        }
      } catch {
        // skip if game doesn't exist
      }
    }
  } catch (err) {
    console.error("loadGame err:", err);
    alert("Failed to load games: " + err.message);
  }
}

window.addEventListener("load", connectWallet);
