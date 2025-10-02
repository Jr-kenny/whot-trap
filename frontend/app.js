// app.js - Whot frontend (drop into frontend/)
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.8.0/+esm";

///////////////////// CONFIG: change these if needed /////////////////////
const HOODI_RPC = "https://ethereum-hoodi-rpc.publicnode.com";
const WHOT_CONTRACT = "0x68c7a00A968Ba627921CD2885ac906DF56F96ABb";
const TRAP_CONTRACT = "0xd5dcdfb129BAf1Ae2A2b73252202a03AEDf9006D";
//////////////////////////////////////////////////////////////////////////

// ABI fragments (minimal; used for calls)
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

const trapAbi = [
  "function collect() view returns (bytes)",
  "function shouldRespond(bytes[] calldata) pure returns (bool, bytes)"
];

const provider = new ethers.JsonRpcProvider(HOODI_RPC);
const whot = new ethers.Contract(WHOT_CONTRACT, whotAbi, provider);
const trap = new ethers.Contract(TRAP_CONTRACT, trapAbi, provider);

// UI elements
const connectBtn = document.getElementById("connectBtn");
const refreshBtn = document.getElementById("refreshBtn");
const createGameBtn = document.getElementById("createGameBtn");
const joinGameBtn = document.getElementById("joinGameBtn");
const startGameBtn = document.getElementById("startGameBtn");
const playCardBtn = document.getElementById("playCardBtn");
const drawBtn = document.getElementById("drawBtn");
const declareLastBtn = document.getElementById("declareLastBtn");
const declareSemiLastBtn = document.getElementById("declareSemiLastBtn");
const viewLatestBtn = document.getElementById("viewLatestBtn");
const refreshInput = document.getElementById("gameIdInput");
const maxPlayersInput = document.getElementById("maxPlayers");

const playersRow = document.getElementById("playersRow");
const handDiv = document.getElementById("hand");
const selectedDiv = document.getElementById("selectedCard");
const topCardDiv = document.getElementById("topCard");
const pileMeta = document.getElementById("pileMeta");
const deckCount = document.getElementById("deckCount");
const logList = document.getElementById("logList");
const trapStatus = document.getElementById("trapStatus");
const trapPayload = document.getElementById("trapPayload");
const whotAddrEl = document.getElementById("whotAddr");
const trapAddrEl = document.getElementById("trapAddr");
const statusBox = document.getElementById("statusBox");

whotAddrEl.href = `https://hoodi.etherscan.io/address/${WHOT_CONTRACT}`;
whotAddrEl.textContent = WHOT_CONTRACT;
trapAddrEl.href = `https://hoodi.etherscan.io/address/${TRAP_CONTRACT}`;
trapAddrEl.textContent = TRAP_CONTRACT;

let signer = null;
let signerAddress = null;
let selectedCard = null;
let myHand = []; // UI-only representation of player's hand (best-effort)

const SUITS = ["Circle","Triangle","Cross","Square","Star","Whot"];
// If your contract's Suit enum uses different ordering, change this array accordingly.

function toShort(addr){
  if(!addr) return "—";
  return addr.slice(0,6) + "…" + addr.slice(-4);
}

function addLog(text){
  const el = document.createElement("div");
  el.className = "log-item";
  el.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logList.prepend(el);
}

// --- wallet connection ---
connectBtn.onclick = async () => {
  if(!window.ethereum){
    alert("Install MetaMask or compatible wallet to sign transactions.");
    return;
  }
  const providerWallet = new ethers.BrowserProvider(window.ethereum);
  const accounts = await providerWallet.send("eth_requestAccounts", []);
  signer = await providerWallet.getSigner();
  signerAddress = await signer.getAddress();
  connectBtn.textContent = toShort(signerAddress);
  addLog("Wallet connected: " + signerAddress);
};

// --- refresh display ---
refreshBtn.onclick = async () => {
  await refreshAll();
};

viewLatestBtn.onclick = async () => {
  await loadLatestGame();
};

// Create game
createGameBtn.onclick = async () => {
  if(!signer) { alert("Connect wallet"); return;}
  const maxP = parseInt(maxPlayersInput.value||4);
  const withAI = false;
  const contract = whot.connect(signer);
  try{
    statusBox.textContent = "Creating game...";
    const tx = await contract.createGame(maxP, withAI);
    addLog("createGame tx sent");
    await tx.wait?.();
    addLog("Game created");
    await refreshAll();
  }catch(e){
    console.error(e); addLog("createGame error: "+(e.message||e));
  } finally { statusBox.textContent = "Ready"; }
};

// Join game
joinGameBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = parseInt(refreshInput.value);
  if(!id) return alert("Enter game id");
  try{
    const contract = whot.connect(signer);
    const tx = await contract.joinGame(id, false);
    addLog("joinGame tx sent");
    await tx.wait?.();
    addLog("Joined game "+id);
    await refreshAll();
  }catch(e){ console.error(e); addLog("join error: "+(e.message||e)); }
};

// Start game
startGameBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = parseInt(refreshInput.value);
  if(!id) return alert("Enter game id");
  try{
    const contract = whot.connect(signer);
    const tx = await contract.startGame(id);
    addLog("startGame tx sent");
    await tx.wait?.();
    addLog("Game started "+id);
    await refreshAll();
  }catch(e){ console.error(e); addLog("start error: "+(e.message||e)); }
};

// Play card
playCardBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const gameId = parseInt(refreshInput.value);
  if(!gameId) return alert("need game id");
  if(!selectedCard) return alert("select a card from your hand");
  const {number, suit} = selectedCard;
  const suitIndex = SUITS.indexOf(suit);
  try{
    const contract = whot.connect(signer);
    const tx = await contract.playCard(gameId, number, suitIndex);
    addLog(`Playing ${number} ${suit} on game ${gameId}`);
    await tx.wait?.();
    addLog("Card played");
    await refreshAll();
  }catch(e){ console.error(e); addLog("playCard error: "+(e.message||e)); }
};

// Draw card
drawBtn.onclick = async () => {
  if(!signer) return alert("Connect wallet");
  const id = parseInt(refreshInput.value);
  if(!id) return alert("Enter game id");
  try{
    const contract = whot.connect(signer);
    const tx = await contract.drawOne(id);
    addLog("drawOne tx sent");
    await tx.wait?.();
    addLog("Drew one card");
    await refreshAll();
  }catch(e){ console.error(e); addLog("draw error: "+(e.message||e)); }
};

declareLastBtn.onclick = async ()=> {
  if(!signer) return alert("Connect wallet");
  const id = parseInt(refreshInput.value); if(!id) return alert("id");
  try{ const c = whot.connect(signer); const tx = await c.declareLast(id); addLog("declareLast sent"); await tx.wait?.(); addLog("Declared last"); await refreshAll(); }catch(e){ console.error(e); addLog("declare last err:"+e.message); }
};
declareSemiLastBtn.onclick = async ()=> {
  if(!signer) return alert("Connect wallet");
  const id = parseInt(refreshInput.value); if(!id) return alert("id");
  try{ const c = whot.connect(signer); const tx = await c.declareSemiLast(id); addLog("declareSemiLast sent"); await tx.wait?.(); addLog("Declared semi-last"); await refreshAll(); }catch(e){ console.error(e); addLog("declare semilast err:"+e.message); }
};

// UI helpers
function renderHand() {
  handDiv.innerHTML = "";
  myHand.forEach((card, i)=>{
    const el = document.createElement("div");
    el.className = "hand-card";
    el.innerHTML = `<div style="font-weight:700">${card.number}</div><div style="font-size:12px;color:var(--muted)">${card.suit}</div>`;
    el.onclick = ()=> {
      selectedCard = card;
      document.querySelectorAll(".hand-card").forEach(n=>n.classList.remove("selected"));
      el.classList.add("selected");
      selectedDiv.textContent = `${card.number} ${card.suit}`;
    };
    handDiv.appendChild(el);
  });
}

// Try to safely extract fields from games() result (best-effort)
function parseGameStruct(res) {
  try{
    // many templates return: id, creator, playersJoined, currentPlayerIndex, started, finished, ...
    const id = res[0];
    const creator = res[1];
    const playersJoined = Number(res[2] ?? 0);
    const currentTurn = Number(res[3] ?? 0);
    const started = !!res[4];
    const finished = !!res[5];
    // last card may be nested (res[7]) — try to get known fields
    let lastCard = null;
    if(res[7] && Array.isArray(res[7])) {
      const c = res[7];
      const cardNumber = c[0] ?? c.number ?? null;
      const suit = c[1] ?? c.suit ?? null;
      lastCard = { number: cardNumber, suit: suit };
    }
    return { id, creator, playersJoined, currentTurn, started, finished, lastCard };
  }catch(e){
    return null;
  }
}

// Refresh functions
async function loadLatestGame() {
  try{
    const next = await whot.nextGameId();
    const latestId = Math.max(1, Number(next) - 1);
    refreshInput.value = latestId;
    await loadGame(latestId);
  }catch(e){ console.error(e); addLog("loadLatest error: "+(e.message||e)); }
}

async function loadGame(gameId) {
  if(!gameId) return;
  try{
    const res = await whot.games(gameId);
    const parsed = parseGameStruct(res);
    playersRow.innerHTML = "";
    const playersCount = parsed?.playersJoined ?? "—";
    for(let i=0;i<Math.max(2,playersCount);i++){
      const p = document.createElement("div");
      p.className = "player";
      p.innerHTML = `<div class="avatar">${i+1}</div><div class="muted">Player ${i+1}</div>`;
      playersRow.appendChild(p);
    }
    topCardDiv.textContent = parsed?.lastCard ? `${parsed.lastCard.number} ${parsed.lastCard.suit}` : "—";
    pileMeta.textContent = `Players: ${playersCount} • Status: ${parsed?.started ? (parsed?.finished ? "Finished":"Started") : "Waiting"}`;
    addLog(`Loaded game ${gameId}`);
  }catch(e){
    console.error(e); addLog("loadGame error: "+(e.message||e));
  }
}

async function refreshTrap(){
  try{
    const data = await trap.collect();
    // decode cautiously: try common pattern (uint256,uint8,uint8,bool,bool,uint256)
    let decoded=null;
    const abi = ethers.AbiCoder.defaultAbiCoder();
    try{
      decoded = abi.decode(["uint256","uint8","uint8","bool","bool","uint256"], data);
      trapStatus.textContent = decoded ? (decoded[3] ? "active" : "inactive") : "unknown";
      trapPayload.textContent = `lastGame:${decoded[0]} players:${decoded[1]}`;
    }catch(_){
      // fallback: show raw hex
      trapStatus.textContent = "raw";
      trapPayload.textContent = data?.toString() || "—";
    }
  }catch(e){ console.error(e); trapStatus.textContent = "error"; trapPayload.textContent = e.message || ""; }
}

async function refreshAll(){
  statusBox.textContent = "Refreshing…";
  try{
    await loadLatestGame();
    await refreshTrap();
  }catch(e){ console.error(e); addLog("refreshAll err: "+(e.message||e)); }
  statusBox.textContent = "Ready";
}

// seed the UI with a fake hand (visual only) so the UI looks like a real Whot table.
// You can replace this with actual hand reading if the contract exposes hands.
function seedHand(){
  myHand = [
    {number: 3, suit: "Circle"},
    {number: 2, suit: "Cross"},
    {number: 8, suit: "Star"},
    {number: 14, suit: "Triangle"},
    {number: 20, suit: "Whot"}
  ];
  renderHand();
}

seedHand();
refreshAll();
