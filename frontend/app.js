const shapes = ["circle", "cross", "star", "square", "triangle"];
const deck = [];

// Generate deck
shapes.forEach(shape => {
  for (let i = 1; i <= 14; i++) {
    deck.push({ shape, value: i });
  }
});
deck.push({ shape: "whot", value: 20 });
deck.push({ shape: "whot", value: 20 });

shuffle(deck);

let playerHand = deck.splice(0, 5);
let opponentHand = deck.splice(0, 5);
let discardPile = [deck.pop()];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function render() {
  const playerDiv = document.getElementById("player-hand");
  const opponentDiv = document.getElementById("opponent-hand");
  const discardDiv = document.getElementById("discard-pile");
  const messageBox = document.getElementById("message-box");

  playerDiv.innerHTML = "";
  opponentDiv.innerHTML = "";
  discardDiv.innerHTML = "";

  playerHand.forEach((card, idx) => {
    const c = document.createElement("div");
    c.className = `card ${card.shape}`;
    c.textContent = card.value;
    c.onclick = () => playCard(idx);
    playerDiv.appendChild(c);
  });

  opponentHand.forEach(() => {
    const c = document.createElement("div");
    c.className = "card back";
    c.textContent = "🂠";
    opponentDiv.appendChild(c);
  });

  let top = discardPile[discardPile.length - 1];
  const c = document.createElement("div");
  c.className = `card ${top.shape}`;
  c.textContent = top.value;
  discardDiv.appendChild(c);

  messageBox.textContent = `Your turn. Play a card or pick from market.`;
}

function playCard(index) {
  let card = playerHand[index];
  let top = discardPile[discardPile.length - 1];

  if (card.shape === "whot" || card.shape === top.shape || card.value === top.value) {
    discardPile.push(card);
    playerHand.splice(index, 1);
    render();
    setTimeout(opponentTurn, 1000);
  } else {
    alert("Invalid move!");
  }
}

function opponentTurn() {
  let top = discardPile[discardPile.length - 1];
  let validIndex = opponentHand.findIndex(
    c => c.shape === top.shape || c.value === top.value || c.shape === "whot"
  );

  if (validIndex >= 0) {
    discardPile.push(opponentHand[validIndex]);
    opponentHand.splice(validIndex, 1);
  } else {
    opponentHand.push(deck.pop());
  }
  render();
}

document.getElementById("draw-btn").onclick = () => {
  playerHand.push(deck.pop());
  render();
};

render();
