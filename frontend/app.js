// app.js — Whot frontend with wallet connect + Hoodi enforcement + Nigerian Whot rules
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.0/+esm";

/* =================== CONFIG - Update if needed =================== */
const HOODI_RPC = "https://ethereum-hoodi-rpc.publicnode.com";
const WHOT_CONTRACT = "0x68c7a00A968Ba627921CD2885ac906DF56F96ABb"; // deployed whot
const TRAP_CONTRACT = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D";  // deployed trap
const HOODI_CHAIN_ID = 560048;
/* ================================================================= */

/* Minimal ABIs for calls and txs */
const whotAbi = [
  "function nextGameId() view returns (uint256)",
  "function createGame(uint8,bool) returns (uint256)",
  "function joinGame(uint256,bool)",
  "function startGame(uint256)",
  "function playCard(uint256,uint8,uint8)",
  "function drawOne(uint256)",
  "function declareLast(uint256)",
  "function declareSemiLast(uint256)",
  "function games(uint256) view returns (uint256,address,uint8,uint8,bool,bool,bool,tuple,uint8,uint16,uint8,uint8,uint256)",
  "event GameCreated(uint256,address,uint8)",
  "event CardPlayed(uint256,address,uint8,uint8,bool,uint8)"
];

const trapAbi = ["function collect() view returns (bytes)"];

const provider = new ethers.JsonRpcProvider(HOODI_RPC);
const whot = new ethers.Contract(WHOT_CONTRACT, whotAbi, provider);
const trap = new ethers.Contract(TRAP_CONTRACT, trapAbi, provider);

/* UI elements */
const connectBtn = document.getElementById("connectBtn");
const networkBadge = document.getElementById("networkBadge");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const viewLatestBtn = document.getElementById("viewLatestBtn");
const pickBtn = document.getElementById("pickBtn");
const drawBtn = document.getElementById("drawBtn");
const playBtn = document.getElementById("playBtn");
const declareLastBtn = document.getElementById("declareLast");
const declareSemiBtn = document.getElementById("declareSemi");
const gameIdInput = document.getElementById("gameIdInput");
const maxPlayersInput = document.getElementById("maxPlayers");

const infoGame = document.getElementById("infoGame");
const infoPlayers = document.getElementById("infoPlayers");
const infoTurn = document.getElementById("infoTurn");
const infoStatus = document.getElementById("infoStatus");

const playerHandDiv = document.getElementById("playerHand");
const topCardDiv = document.getElementById("topCard");
const pileMeta = document.getElementById("pileMeta");
const deckCount = document.getElementById("deckCount");
const trapState = document.getElementById("trapState");
const whotLink = document.getElementById("whotLink");
const trapLink = document.getElementById("trapLink");
const logDiv = document.getElementById("log");
const selectedDiv = document.getElementById("selected");

whotLink.href = `https://hoodi.etherscan.io/address/${WHOT_CONTRACT}`;
whotLink.textContent = WHOT_CONTRACT;
trapLink.href = `https://hoodi.etherscan.io/address/${TRAP_CONTRACT}`;
trapLink.textContent = TRAP_CONTRACT;

let walletProvider = null;
let signer = null;
let signerAddress = null;
let selectedCard = null;

/* Whot shapes mapping (Nigerian names / use numbers for contract if required) */
const SUIT_NAMES = ["Circle","Triangle","Cross","Square","Star","Whot"]; // adjust order if contract different

/* UI helpers */
function log(msg){
  const el = document.createElement("div");
  el.className = "item";
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.prepend(el);
}
function setNetworkBadge(t){ networkBadge.textContent = `Network: ${t}`; }

/* Wallet connect + network check */
connectBtn.onclick = async () => {
  if(!window.ethereum) {
    alert("MetaMask or compatible wallet required.");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    walletProvider = new ethers.BrowserProvider(window.ethereum);
    signer = await walletProvider.getSigner();
    signerAddress = await signer.getAddress();
    connectBtn.textContent = `${signerAddress.slice(0,6)}…${signerAddress.slice(-4)}`;
    log(`Connected ${signerAddress}`);

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);
    if(chainId !== HOODI_CHAIN_ID){
      // try to switch network
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + HOODI_CHAIN_ID.toString(16) }]
        });
        setNetworkBadge("Hoodi");
        log("Switched to Hoodi");
      } catch (switchErr) {
        // try to add chain
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x" + HOODI_CHAIN_ID.toString(16),
              chainName: "Hoodi Testnet",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [HOODI_RPC],
              blockExplorerUrls: ["https://hoodi.etherscan.io"]
            }]
          });
          setNetworkBadge("Hoodi");
          log("Added Hoodi network");
        } catch(addErr){
          alert("Please switch your wallet to Hoodi testnet (chain id 560048).");
        }
      }
    } else {
      setNetworkBadge("Hoodi");
    }
  } catch(e) {
    console.error(e);
    log("Wallet connection failed");
  }
};

/* Lobby actions: create / join / start / view latest */
createBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet first");
  const maxP = Number(maxPlayersInput.value || 4);
  const contract = whot.connect(signer);
  try {
    log("Creating game...");
    const tx = await contract.createGame(maxP, false);
    log("create tx sent");
    await tx.wait?.();
    log("Game created");
    await viewLatest();
  } catch(e){ console.error(e); log("create failed: "+(e?.message||e)); }
};

joinBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet first");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  try {
    const c = whot.connect(signer);
    const tx = await c.joinGame(id, false);
    log(`join tx sent for ${id}`);
    await tx.wait?.();
    log("Joined game " + id);
    await loadGame(id);
  } catch(e){ console.error(e); log("join error: "+(e?.message||e)); }
};

startBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet first");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  try {
    const c = whot.connect(signer);
    const tx = await c.startGame(id);
    log("start sent");
    await tx.wait?.();
    log("Game started");
    await loadGame(id);
  } catch(e){ console.error(e); log("start error: "+(e?.message||e)); }
};

viewLatestBtn.onclick = async () => { await viewLatest(); };

/* Play/pick/draw actions */
pickBtn.onclick = async () => {
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  if(!signer) return alert("Connect wallet");
  try {
    const c = whot.connect(signer);
    const tx = await c.drawOne(id);
    log("pick (draw) tx sent");
    await tx.wait?.();
    log("Picked from market");
    await loadGame(id);
  } catch(e){ console.error(e); log("pick error:"+ (e?.message||e)); }
};

drawBtn.onclick = pickBtn.onclick;

playBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0);
  if(!id) return alert("Enter game id");
  if(!selectedCard) return alert("Select a card from your hand");
  // selectedCard = {number, suitIndex}
  try {
    const c = whot.connect(signer);
    const tx = await c.playCard(id, selectedCard.number, selectedCard.suitIndex);
    log(`playCard tx sent: ${selectedCard.number} ${SUIT_NAMES[selectedCard.suitIndex]}`);
    await tx.wait?.();
    log("Card played on-chain");
    selectedCard = null;
    selectedDiv.textContent = "Selected: none";
    await loadGame(id);
  } catch(e){ console.error(e); log("play error:"+ (e?.message||e)); }
};

declareLastBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0); if(!id) return alert("id");
  try { const c = whot.connect(signer); const tx = await c.declareLast(id); await tx.wait?.(); log("Declared last"); await loadGame(id);} catch(e){ log("declareLast err:"+ (e?.message||e)); }
};

declareSemiBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = Number(gameIdInput.value || 0); if(!id) return alert("id");
  try { const c = whot.connect(signer); const tx = await c.declareSemiLast(id); await tx.wait?.(); log("Declared semi-last"); await loadGame(id);} catch(e){ log("declareSemi err:"+ (e?.message||e)); }
};

/* Helpers: parse games struct (best-effort) */
function parseGameStruct(res){
  // expect something like: id, creator, playersJoined, currentTurn, started, finished, ... , lastCardStruct, ...
  // attempt safe extraction
  const id = Number(res[0] ?? 0);
  const playersJoined = Number(res[2] ?? 0);
  const currentTurn = Number(res[3] ?? 0);
  const started = !!res[4];
  const finished = !!res[5];
  let lastCard = null;
  try {
    const maybe = res[7];
    if(maybe && (Array.isArray(maybe) || typeof maybe === "object")){
      const cardNumber = Number(maybe[0] ?? maybe.number ?? 0);
      const cardSuit = Number(maybe[1] ?? maybe.suit ?? 0);
      lastCard = { number: cardNumber, suit: cardSuit };
    }
  } catch(e){ lastCard = null; }
  return { id, playersJoined, currentTurn, started, finished, lastCard };
}

/* render game UI */
async function renderGame(parsed){
  infoGame.textContent = parsed?.id ?? "—";
  gameIdInput.value = parsed?.id ?? ""; // Ensure input field is updated
  infoPlayers.textContent = parsed?.playersJoined ?? "—";
  infoTurn.textContent = parsed?.currentTurn ?? "—";
  infoStatus.textContent = parsed?.started ? (parsed?.finished ? "Finished":"Started") : "Waiting";

  // show top card
  topCardDiv.className = "card big";
  if(parsed?.lastCard){
    const n = parsed.lastCard.number;
    const sIdx = parsed.lastCard.suit;
    const suitName = SUIT_NAMES[sIdx] ?? `s${sIdx}`;
    topCardDiv.textContent = `${n} ${suitName}`;
    pileMeta.textContent = `Players: ${parsed.playersJoined} • ${infoStatus.textContent}`;
    
    // Apply CSS class for suit/shape
    const suitClass = SUIT_NAMES[sIdx]?.toLowerCase();
    if (suitClass) {
      topCardDiv.classList.add(suitClass);
    }
  } else {
    topCardDiv.textContent = "—";
    pileMeta.textContent = `Players: ${parsed?.playersJoined ?? "—"}`;
  }

  // fetch trap collect to show some trap info
  try {
    const raw = await trap.collect();
    // try to decode common layout: (uint256 nextId, uint8 players, uint8 current, bool started, bool finished, uint256 logs)
    const abi = ethers.AbiCoder.defaultAbiCoder();
    try {
      const dec = abi.decode(["uint256","uint8","uint8","bool","bool","uint256"], raw);
      trapState.textContent = `last:${dec[0]} players:${dec[1]} started:${dec[3]}`;
    } catch(_) {
      trapState.textContent = raw ? raw.toString() : "—";
    }
  } catch(e){ trapState.textContent = "trap error"; }

  // if contract exposes player-hand we would fetch it; else we render placeholder
  // For safety we show a UI that allows a player to select a card; actual hand fetch requires contract support.
  renderLocalHand();
}

/* Local UI hand and selection — frontend enforces Whot rules for click feedback.
   IMPORTANT: this is UI-level validation. Actual validation occurs on-chain in contract.
*/
let uiHand = [
  // visual seed if contract doesn't provide the player's hand
  { number: 3, suitIndex: 0 }, // circle
  { number: 2, suitIndex: 2 }, // cross
  { number: 8, suitIndex: 4 }, // star
  { number: 14, suitIndex: 1 }, // triangle
  { number: 20, suitIndex: 5 }  // whot
];

function renderLocalHand(){
  playerHandDiv.innerHTML = "";
  uiHand.forEach((c, idx) => {
    const el = document.createElement("div");
    const suitClass = c.suitIndex === 5 ? "whot" : SUIT_NAMES[c.suitIndex]?.toLowerCase() ?? "";
    el.className = `card ${suitClass}`;
    el.textContent = c.number;
    el.dataset.idx = idx; // Store index for easier lookup in selectCard

    // Check if this card is the currently selected one and apply the 'selected' class
    if (selectedCard && selectedCard.number === c.number && selectedCard.suitIndex === c.suitIndex) {
      el.classList.add('selected');
    }
    
    el.onclick = () => selectCard(idx);
    playerHandDiv.appendChild(el);
  });
}

function selectCard(idx){
  const targetCard = uiHand[idx];
  // Handle deselection (same card clicked again)
  if (selectedCard && selectedCard.number === targetCard.number && selectedCard.suitIndex === targetCard.suitIndex) {
    selectedCard = null;
  } else {
    selectedCard = targetCard;
  }
  selectedDiv.textContent = `Selected: ${selectedCard ? `${selectedCard.number} ${SUIT_NAMES[selectedCard.suitIndex]}` : 'none'}`;
  renderLocalHand(); // Rerender hand to update 'selected' class based on the new state
}

/* View latest and load game */
async function viewLatest(){
  try{
    const n = await whot.nextGameId();
    const last = Math.max(1, Number(n)-1);
    gameIdInput.value = last;
    await loadGame(last);
  }catch(e){ console.error(e); log("viewLatest error:"+ (e?.message||e)); }
}

async function loadGame(id){
  if(!id) return;
  try{
    const res = await whot.games(id);
    const parsed = parseGameStruct(res);
    await renderGame(parsed);
    log("Loaded game "+id);
  }catch(e){ console.error(e); log("loadGame err:"+ (e?.message||e)); }
}

/* Initial seed & UI wiring */
(async function init(){
  // initial info
  try {
    const next = await whot.nextGameId();
    gameIdInput.placeholder = `latest (next id ${next})`;
    deckCount.textContent = "—";
  } catch(e){ console.warn("init: whot nextGameId failed", e); }
  setNetworkBadge("unknown");
  renderLocalHand();
})();
