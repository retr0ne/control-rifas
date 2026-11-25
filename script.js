import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const CONFIG = {
  supabaseUrl: "https://poynaobhimszajcctafr.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBveW5hb2JoaW1zemFqY2N0YWZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjUwMTMsImV4cCI6MjEwMDc0MTAxM30.QDd-P9AiyH7fohSEPtwAJBSlYmATL3iaGzJZ7ibf7fk",
  adminPin: "0918",
  sessionKey: "rifas_admin_unlocked",
  currency: "COP"
};

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

const $ = (selector) => document.querySelector(selector);

const elements = {
  clientPaymentModal: $("#clientPaymentModal"),
  clientPaymentForm: $("#clientPaymentForm"),
  clientPaymentDetails: $("#clientPaymentDetails"),
  confirmClientPaymentButton: $("#confirmClientPaymentButton"),

  raffleSelect: $("#raffleSelect"),
  newRaffleButton: $("#newRaffleButton"),
  lockButton: $("#lockButton"),
  raffleOverview: $("#raffleOverview"),
  raffleTitle: $("#raffleTitle"),
  drawDate: $("#drawDate"),
  editRaffleButton: $("#editRaffleButton"),
  editRaffleModal: $("#editRaffleModal"),
  editRaffleForm: $("#editRaffleForm"),
  editRaffleName: $("#editRaffleName"),
  finishRaffleButton: $("#finishRaffleButton"),
  finishRaffleModal: $("#finishRaffleModal"),
  finishRaffleForm: $("#finishRaffleForm"),
  finishRaffleDetails: $("#finishRaffleDetails"),
  confirmFinishRaffleButton: $("#confirmFinishRaffleButton"),
  soldMetric: $("#soldMetric"),
  availableMetric: $("#availableMetric"),
  paidMetric: $("#paidMetric"),
  pendingMetric: $("#pendingMetric"),
  emptyState: $("#emptyState"),
  ticketsGrid: $("#ticketsGrid"),

  raffleModal: $("#raffleModal"),
  raffleForm: $("#raffleForm"),
  raffleName: $("#raffleName"),
  rafflePrice: $("#rafflePrice"),
  raffleDate: $("#raffleDate"),
  raffleLottery: $("#raffleLottery"),

  ticketModal: $("#ticketModal"),
  ticketForm: $("#ticketForm"),
  ticketModalKicker: $("#ticketModalKicker"),
  ticketModalTitle: $("#ticketModalTitle"),
  ticketHelp: $("#ticketHelp"),
  buyerInput: $("#buyerInput"),
  extraNumbersField: $("#extraNumbersField"),
  extraNumbersInput: $("#extraNumbersInput"),
  deleteTicketButton: $("#deleteTicketButton"),
  saveTicketButton: $("#saveTicketButton"),

  pinModal: $("#pinModal"),
  pinForm: $("#pinForm"),
  pinInput: $("#pinInput"),
  toast: $("#toast"),

  downloadImageButton: $("#downloadImageButton"),
  clientsList: $("#clientsList"),
  clientsEmpty: $("#clientsEmpty"),
  clientsCount: $("#clientsCount"),
  clientsSearch: $("#clientsSearch"),
};

let pendingClientPaymentBuyer = null;
let raffles = [];
let activeRaffle = null;
let tickets = [];
let ticketMap = new Map();
let raffleChannel = null;
let ticketChannel = null;
let pendingProtectedAction = null;
let toastTimer = null;

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: CONFIG.currency,
  maximumFractionDigits: 0
});

function isAdmin() {
  return sessionStorage.getItem(CONFIG.sessionKey) === "true";
}

function updateLockButton() {
  elements.lockButton.hidden = !isAdmin();
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", isError);
  elements.toast.classList.add("is-visible");

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 3500);
}

function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(dateValue));
}

function formatNumber(number) {
  return String(Number(number)).padStart(2, "0");
}

function getPaymentState() {
  return document.querySelector('input[name="paymentState"]:checked').value === "paid";
}

function isRaffleFinalized() {
  return Boolean(activeRaffle?.is_finalized);
}

function canModifyTickets() {
  if (!activeRaffle) return false;

  if (isRaffleFinalized()) {
    showToast("Esta rifa está finalizada; las boletas están bloqueadas.", true);
    return false;
  }

  return true;
}

function hasReachedDrawDate() {
  return activeRaffle && new Date(activeRaffle.draw_date).getTime() <= Date.now();
}

function requireAdmin(callback) {
  if (isAdmin()) {
    callback();
    return;
  }

  pendingProtectedAction = callback;
  elements.pinInput.value = "";
  showDialog(elements.pinModal);
  setTimeout(() => elements.pinInput.focus(), 100);
}

function setActiveRaffle(raffleId) {
  activeRaffle = raffles.find((raffle) => raffle.id === raffleId) || null;
  tickets = [];
  ticketMap = new Map();

  updateOverview();
  renderTickets();
  subscribeToTickets();

  if (activeRaffle) loadTickets();
}

function updateOverview() {
  const hasRaffle = Boolean(activeRaffle);

  elements.raffleOverview.hidden = !hasRaffle;
  elements.emptyState.hidden = hasRaffle;
  elements.editRaffleButton.hidden = !hasRaffle;
  elements.finishRaffleButton.hidden = !hasRaffle;

  if (!hasRaffle) {
    renderClients();
    return;
  }

  const price = Number(activeRaffle.ticket_price);
  const sold = tickets.length;
  const available = 100 - sold;
  const paid = tickets.filter((ticket) => ticket.is_paid).length;
  const pending = sold - paid;

  elements.raffleTitle.textContent = activeRaffle.title;
  elements.drawDate.textContent = formatDate(activeRaffle.draw_date);
  elements.finishRaffleButton.disabled = isRaffleFinalized();
  elements.finishRaffleButton.textContent = isRaffleFinalized()
    ? "Rifa finalizada"
    : "Finalizar rifa";
  elements.soldMetric.textContent = `${sold}/100`;
  elements.availableMetric.textContent = String(available);
  elements.paidMetric.textContent = money.format(paid * price);
  elements.pendingMetric.textContent = money.format(pending * price);
}

function renderTickets() {
  elements.ticketsGrid.replaceChildren();

  if (!activeRaffle) return;

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 100; index += 1) {
    const number = String(index).padStart(2, "0");
    const ticket = ticketMap.get(number);
    const card = document.createElement("button");

    card.type = "button";
    card.className = `ticket ticket--${ticket ? (ticket.is_paid ? "paid" : "pending") : "free"}`;
    card.setAttribute(
      "aria-label",
      ticket
        ? `Boleta ${number}, ${ticket.is_paid ? "pagada" : "pendiente"}, comprador ${ticket.buyer}`
        : `Boleta ${number}, libre`
    );

    const numberElement = document.createElement("span");
    numberElement.className = "ticket__number";
    numberElement.textContent = number;
    card.append(numberElement);

    if (ticket) {
      const badge = document.createElement("span");
      badge.className = `badge badge--${ticket.is_paid ? "paid" : "pending"}`;
      badge.textContent = ticket.is_paid ? "Pagado" : "Pendiente";

      const buyer = document.createElement("p");
      buyer.className = "ticket__buyer";
      buyer.textContent = ticket.buyer;

      card.append(badge, buyer);
    }

    card.classList.toggle("ticket--locked", isRaffleFinalized());
    card.addEventListener("click", () => {
      if (!canModifyTickets()) return;
      requireAdmin(() => openTicketModal(number));
    });

    fragment.append(card);
  }

  elements.ticketsGrid.append(fragment);
  renderClients();
}

function renderClients() {
  if (
    !elements.clientsList ||
    !elements.clientsEmpty ||
    !elements.clientsCount
  ) {
    return;
  }

  elements.clientsList.replaceChildren();

  if (!activeRaffle || !tickets.length) {
    elements.clientsEmpty.hidden = false;
    elements.clientsCount.textContent = "0";
    return;
  }
  const groupedClients = new Map();

  tickets
    .slice()
    .sort((a, b) => Number(a.number) - Number(b.number))
    .forEach((ticket) => {
      const buyer = ticket.buyer.trim();

      if (!groupedClients.has(buyer)) {
        groupedClients.set(buyer, {
          numbers: [],
          pendingCount: 0
        });
      }

      const client = groupedClients.get(buyer);
      client.numbers.push(ticket.number);

      if (!ticket.is_paid) {
        client.pendingCount += 1;
      }
    });

  const searchTerm = elements.clientsSearch.value.trim().toLocaleLowerCase("es-CO");
  const visibleClients = [...groupedClients].filter(([buyer]) =>
    buyer.toLocaleLowerCase("es-CO").includes(searchTerm)
  );

  elements.clientsEmpty.hidden = visibleClients.length > 0;
  elements.clientsEmpty.textContent = searchTerm
    ? "No se encontraron clientes con ese nombre."
    : "Aún no hay boletas asignadas.";
  elements.clientsCount.textContent = String(visibleClients.length);

  visibleClients.forEach(([buyer, client]) => {
    const item = document.createElement("li");
    item.className = "client-line";

    const text = document.createElement("span");
    text.className = "client-line__text";

    const name = document.createElement("strong");
    name.textContent = `+${buyer}: `;

    text.append(name, document.createTextNode(client.numbers.join(", ")));
    item.append(text);

    if (client.pendingCount > 0 && !isRaffleFinalized()) {
      const payButton = document.createElement("button");
      payButton.type = "button";
      payButton.className = "client-pay-button";
      payButton.textContent = `Pagar ${client.pendingCount}`;

      payButton.addEventListener("click", () => {
        requireAdmin(() => openClientPaymentModal(buyer));
      });

      item.append(payButton);
    }

    elements.clientsList.append(item);
  });
}

async function downloadRaffleImage() {
  if (!activeRaffle) {
    showToast("Selecciona una rifa antes de descargar la imagen.", true);
    return;
  }

  const palette = getImagePalette(activeRaffle.image_template);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const width = 1200;
  const height = 1800;
  const gridX = 84;
  const gridY = 505;
  const gridWidth = width - (gridX * 2);
  const cellSize = gridWidth / 10;
  const sold = tickets.length;
  const available = 100 - sold;

  canvas.width = width;
  canvas.height = height;

  drawRaffleBackground(context, width, height, palette);

  context.fillStyle = palette.card;
  roundedRect(context, 120, 104, 960, 260, 54);
  context.fill();

  context.fillStyle = palette.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "800 38px Georgia, serif";
  context.fillText("GRAN RIFA", width / 2, 166);
  drawFittedText(context, activeRaffle.title.toUpperCase(), width / 2, 245, 760, 82, "800", "Georgia, serif", palette.ink);
  context.font = "600 25px Arial, sans-serif";
  context.fillStyle = palette.inkSoft;
  context.fillText(formatDate(activeRaffle.draw_date), width / 2, 292);
  drawFittedText(context, `Lotería: ${activeRaffle.lottery || "Por definir"}`, width / 2, 328, 790, 22, "700", "Arial, sans-serif", palette.inkSoft);
  drawBurst(context, 226, 233, palette.accent, -1);
  drawBurst(context, 974, 233, palette.accent, 1);

  context.fillStyle = palette.gridShadow;
  roundedRect(context, gridX + 12, gridY + 14, gridWidth, gridWidth, 18);
  context.fill();
  context.fillStyle = palette.gridBorder;
  roundedRect(context, gridX, gridY, gridWidth, gridWidth, 18);
  context.fill();

  for (let index = 0; index < 100; index += 1) {
    const number = String(index).padStart(2, "0");
    const ticket = ticketMap.get(number);
    const column = index % 10;
    const row = Math.floor(index / 10);
    const x = gridX + (column * cellSize) + 3;
    const y = gridY + (row * cellSize) + 3;
    const size = cellSize - 6;

    context.fillStyle = ticket ? palette.sold : palette.free;
    context.fillRect(x, y, size, size);
    context.strokeStyle = ticket ? palette.soldBorder : palette.gridBorder;
    context.lineWidth = 2;
    context.strokeRect(x, y, size, size);

    if (ticket) {
      context.strokeStyle = palette.soldMark;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(x + 13, y + 13);
      context.lineTo(x + size - 13, y + size - 13);
      context.stroke();
    }

    context.fillStyle = ticket ? palette.soldText : palette.number;
    context.font = `700 ${ticket ? 29 : 31}px Arial, sans-serif`;
    context.fillText(number, x + (size / 2), y + (size / 2) + 2);
  }

  context.fillStyle = palette.card;
  roundedRect(context, 116, 1210, 968, 210, 54);
  context.fill();
  context.strokeStyle = palette.ink;
  context.lineWidth = 4;
  roundedRect(context, 132, 1226, 936, 178, 44);
  context.stroke();

  context.fillStyle = palette.ink;
  context.font = "800 46px Arial, sans-serif";
  context.fillText(`¡Quedan ${available} números disponibles!`, width / 2, 1297);
  context.font = "600 27px Arial, sans-serif";
  context.fillStyle = palette.inkSoft;
  context.fillText("Los números coloreados ya fueron asignados.", width / 2, 1350);

  context.fillStyle = palette.ink;
  context.font = "800 36px Georgia, serif";
  context.fillText(`Valor: ${money.format(Number(activeRaffle.ticket_price))}`, width / 2, 1510);
  context.font = "700 24px Arial, sans-serif";
  context.fillStyle = palette.inkSoft;
  context.fillText("¡Participa y gana!", width / 2, 1560);

  const safeTitle = activeRaffle.title
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const fileName = `estado-rifa-${safeTitle || "rifa"}.jpg`;

const imageBlob = await new Promise((resolve) => {
  canvas.toBlob(resolve, "image/jpeg", 0.92);
});

if (!imageBlob) {
  showToast("No fue posible generar la imagen.", true);
  return;
}

const imageFile = new File([imageBlob], fileName, {
  type: "image/jpeg"
});

try {
  // iPhone/iPad: abre la hoja nativa con “Guardar imagen” y “Guardar en Archivos”.
  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files: [imageFile] })
  ) {
    await navigator.share({
      files: [imageFile],
      title: activeRaffle.title,
      text: "Estado de disponibilidad de la rifa"
    });

    showToast("Selecciona “Guardar imagen” o “Guardar en Archivos”.");
    return;
  }
} catch (error) {
  // El usuario cerró la hoja de compartir: no es un error.
  if (error.name === "AbortError") return;
}

// Respaldo para computadores y navegadores sin compartir archivos.
const imageUrl = URL.createObjectURL(imageBlob);
const link = document.createElement("a");

link.href = imageUrl;
link.download = fileName;
document.body.append(link);
link.click();
link.remove();

setTimeout(() => URL.revokeObjectURL(imageUrl), 60000);

showToast("Imagen descargada.");
}

function getImagePalette(template) {
  const templates = {
    warm: {
      background: "#f5837f", card: "#ffc15a", ink: "#592417", inkSoft: "#783820",
      accent: "#d85a35", blob: "#efa0c9", blobAlt: "#5591ad", gridBorder: "#3a211a",
      gridShadow: "rgba(89, 36, 23, .28)", free: "#fffdf8", number: "#27201c",
      sold: "#efa0c9", soldBorder: "#7a3158", soldText: "#522039", soldMark: "#b75576"
    },
    blue: {
      background: "#125ba7", card: "#9ce1ff", ink: "#0b3265", inkSoft: "#135387",
      accent: "#0b4a8b", blob: "#55c6f4", blobAlt: "#bdeeff", gridBorder: "#0c396b",
      gridShadow: "rgba(5, 38, 82, .34)", free: "#f8fdff", number: "#123b6b",
      sold: "#b9e8ff", soldBorder: "#2079b9", soldText: "#0c4a7f", soldMark: "#4e9ed0"
    }
  };

  return templates[template] || templates.warm;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawFittedText(context, text, x, y, maxWidth, maxSize, weight, family, color) {
  let size = maxSize;
  do {
    context.font = `${weight} ${size}px ${family}`;
    size -= 2;
  } while (context.measureText(text).width > maxWidth && size > 14);

  context.fillStyle = color;
  context.fillText(text, x, y);
}

function drawBurst(context, x, y, color, direction) {
  context.strokeStyle = color;
  context.lineWidth = 12;
  context.lineCap = "round";
  [-55, -25, 5, 35, 65].forEach((offset) => {
    context.beginPath();
    context.moveTo(x, y + offset);
    context.lineTo(x + (direction * 70), y + (offset * 1.45));
    context.stroke();
  });
}

function drawRaffleBackground(context, width, height, palette) {
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);

  const blobs = [
    [850, 50, 480, palette.blob], [70, 1240, 480, palette.card],
    [1080, 1480, 420, palette.card], [30, 370, 180, palette.blobAlt],
    [1140, 700, 180, palette.blobAlt], [270, 1670, 220, palette.blob]
  ];
  blobs.forEach(([x, y, size, color]) => {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = palette.card;
  context.lineWidth = 30;
  context.lineCap = "round";
  [[70, 95, 160, 20], [1010, 120, 1130, 45], [40, 1580, 150, 1650], [1000, 1680, 1130, 1740]].forEach(([x1, y1, x2, y2]) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });
}

async function loadRaffles(preferredId = null) {
  const { data, error } = await supabase
    .from("raffles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showToast(`No fue posible cargar las rifas: ${error.message}`, true);
    return;
  }

  const previousId = preferredId || activeRaffle?.id;
  raffles = data || [];

  elements.raffleSelect.replaceChildren();

  if (!raffles.length) {
    const option = new Option("Sin rifas creadas", "");
    elements.raffleSelect.add(option);
    elements.raffleSelect.disabled = true;

    activeRaffle = null;
    tickets = [];
    ticketMap = new Map();
    updateOverview();
    renderTickets();
    return;
  }

  elements.raffleSelect.disabled = false;

  raffles.forEach((raffle) => {
    elements.raffleSelect.add(new Option(raffle.title, raffle.id));
  });

  const selectedId = raffles.some((raffle) => raffle.id === previousId)
    ? previousId
    : raffles[0].id;

  elements.raffleSelect.value = selectedId;

  if (activeRaffle?.id !== selectedId) {
    setActiveRaffle(selectedId);
  } else {
    activeRaffle = raffles.find((raffle) => raffle.id === selectedId);
    updateOverview();
  }
}

async function loadTickets() {
  if (!activeRaffle) return;

  const raffleId = activeRaffle.id;
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("raffle_id", raffleId)
    .order("number", { ascending: true });

  if (error) {
    showToast(`No fue posible cargar las boletas: ${error.message}`, true);
    return;
  }

  // Evita mostrar datos si el usuario cambió de rifa durante la consulta.
  if (activeRaffle?.id !== raffleId) return;

  tickets = data || [];
  ticketMap = new Map(tickets.map((ticket) => [ticket.number, ticket]));
  updateOverview();
  renderTickets();
}

function subscribeToRaffles() {
  if (raffleChannel) return;

  raffleChannel = supabase
    .channel("raffles-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "raffles" },
      () => loadRaffles()
    )
    .subscribe();
}

async function subscribeToTickets() {
  if (ticketChannel) {
    await supabase.removeChannel(ticketChannel);
    ticketChannel = null;
  }

  if (!activeRaffle) return;

  const raffleId = activeRaffle.id;

  ticketChannel = supabase
    .channel(`tickets-${raffleId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tickets",
        filter: `raffle_id=eq.${raffleId}`
      },
      () => loadTickets()
    )
    .subscribe();
}

function openTicketModal(number) {
  if (!canModifyTickets()) return;

  const ticket = ticketMap.get(number);
  const isEditing = Boolean(ticket);

  elements.ticketForm.dataset.number = number;
  elements.ticketForm.dataset.ticketId = ticket?.id || "";
  elements.ticketForm.dataset.mode = isEditing ? "edit" : "create";

  elements.ticketModalKicker.textContent = isEditing
    ? "Administrar boleta"
    : "Nueva asignación";

  elements.ticketModalTitle.textContent = `Número ${number}`;
  elements.ticketHelp.textContent = isEditing
    ? "Edita el comprador, el estado de pago o libera esta boleta."
    : "Puedes asignar otros números libres en esta misma venta.";

  elements.buyerInput.value = ticket?.buyer || "";
  elements.extraNumbersInput.value = "";
  elements.extraNumbersField.hidden = isEditing;
  elements.deleteTicketButton.hidden = !isEditing;
  elements.saveTicketButton.textContent = isEditing ? "Guardar cambios" : "Asignar boletas";

  document.querySelector(
    `input[name="paymentState"][value="${ticket?.is_paid ? "paid" : "pending"}"]`
  ).checked = true;

  showDialog(elements.ticketModal);
  setTimeout(() => elements.buyerInput.focus(), 100);
}

function parseAdditionalNumbers(input) {
  if (!input.trim()) return [];

  const parts = input.split(/[\s,;]+/).filter(Boolean);
  const parsed = [];

  for (const value of parts) {
    if (!/^\d{1,2}$/.test(value)) {
      throw new Error(`"${value}" no es un número válido entre 00 y 99.`);
    }

    parsed.push(formatNumber(value));
  }

  return parsed;
}

async function createRaffle(event) {
  event.preventDefault();

  const title = elements.raffleName.value.trim();
  const ticketPrice = Number(elements.rafflePrice.value);
  const drawDate = elements.raffleDate.value;
  const lottery = elements.raffleLottery.value.trim();
  const imageTemplate = new FormData(elements.raffleForm).get("imageTemplate") || "warm";

  if (!title || !ticketPrice || !drawDate || !lottery) return;

  const { data, error } = await supabase
    .from("raffles")
    .insert({
      title,
      ticket_price: ticketPrice,
      draw_date: new Date(drawDate).toISOString(),
      lottery,
      image_template: imageTemplate
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes("image_template") || error.message?.includes("lottery")) {
      showToast("Antes de crear rifas, ejecuta las migraciones SQL incluidas en el proyecto.", true);
      return;
    }
    showToast(`No se pudo crear la rifa: ${error.message}`, true);
    return;
  }

  closeDialog(elements.raffleModal);
  elements.raffleForm.reset();
  await loadRaffles(data.id);
  showToast("Rifa creada correctamente.");
}

function openEditRaffleModal() {
  if (!activeRaffle) {
    showToast("Selecciona una rifa primero.", true);
    return;
  }

  elements.editRaffleName.value = activeRaffle.title;
  showDialog(elements.editRaffleModal);

  setTimeout(() => {
    elements.editRaffleName.focus();
    elements.editRaffleName.select();
  }, 100);
}

async function saveRaffleName(event) {
  event.preventDefault();

  if (!activeRaffle) return;

  const title = elements.editRaffleName.value.trim();

  if (!title) {
    showToast("Ingresa un nombre para la rifa.", true);
    return;
  }

  const { error } = await supabase
    .from("raffles")
    .update({ title })
    .eq("id", activeRaffle.id);

  if (error) {
    showToast(`No se pudo actualizar el nombre: ${error.message}`, true);
    return;
  }

  closeDialog(elements.editRaffleModal);
  await loadRaffles(activeRaffle.id);
  showToast("Nombre de la rifa actualizado.");
}

function openFinishRaffleModal() {
  if (!activeRaffle || isRaffleFinalized()) return;

  if (!hasReachedDrawDate()) {
    showToast("Solo puedes finalizar la rifa cuando se cumpla la fecha y hora del sorteo.", true);
    return;
  }

  elements.finishRaffleDetails.textContent =
    `Vas a finalizar “${activeRaffle.title}”. El sorteo fue programado para ${formatDate(activeRaffle.draw_date)}.`;
  showDialog(elements.finishRaffleModal);
}

async function finishRaffle(event) {
  event.preventDefault();

  if (!activeRaffle || isRaffleFinalized()) return;

  if (!hasReachedDrawDate()) {
    closeDialog(elements.finishRaffleModal);
    showToast("La fecha y hora del sorteo aún no se cumplen.", true);
    return;
  }

  elements.confirmFinishRaffleButton.disabled = true;

  const { error } = await supabase
    .from("raffles")
    .update({
      is_finalized: true,
      finalized_at: new Date().toISOString()
    })
    .eq("id", activeRaffle.id);

  elements.confirmFinishRaffleButton.disabled = false;

  if (error) {
    if (error.message?.includes("is_finalized")) {
      showToast("Ejecuta la migración de finalización de rifas en Supabase antes de continuar.", true);
      return;
    }
    showToast(`No se pudo finalizar la rifa: ${error.message}`, true);
    return;
  }

  closeDialog(elements.finishRaffleModal);
  await loadRaffles(activeRaffle.id);
  showToast("Rifa finalizada. Las boletas quedaron bloqueadas.");
}

async function saveTicket(event) {
  event.preventDefault();

  if (!canModifyTickets()) return;

  const mode = elements.ticketForm.dataset.mode;
  const number = elements.ticketForm.dataset.number;
  const ticketId = elements.ticketForm.dataset.ticketId;
  const buyer = elements.buyerInput.value.trim();
  const isPaid = getPaymentState();

  if (!buyer) {
    showToast("Ingresa el nombre del comprador.", true);
    return;
  }

  elements.saveTicketButton.disabled = true;

  try {
    if (mode === "edit") {
      const { error } = await supabase
        .from("tickets")
        .update({ buyer, is_paid: isPaid })
        .eq("id", ticketId);

      if (error) throw error;
      showToast("Boleta actualizada.");
    } else {
      const additional = parseAdditionalNumbers(elements.extraNumbersInput.value);
      const selectedNumbers = [...new Set([number, ...additional])];

      const unavailable = selectedNumbers.filter((ticketNumber) =>
        ticketMap.has(ticketNumber)
      );

      if (unavailable.length) {
        throw new Error(`Ya no están libres: ${unavailable.join(", ")}.`);
      }

      const rows = selectedNumbers.map((ticketNumber) => ({
        raffle_id: activeRaffle.id,
        number: ticketNumber,
        buyer,
        is_paid: isPaid
      }));

      const { error } = await supabase.from("tickets").insert(rows);
      if (error) throw error;

      showToast(`${rows.length} boleta(s) asignada(s).`);
    }

    closeDialog(elements.ticketModal);
    await loadTickets();
  } catch (error) {
    showToast(error.message || "No fue posible guardar las boletas.", true);
  } finally {
    elements.saveTicketButton.disabled = false;
  }
}

async function deleteTicket() {
  if (!canModifyTickets()) return;

  const ticketId = elements.ticketForm.dataset.ticketId;
  const number = elements.ticketForm.dataset.number;

  if (!ticketId) return;

  if (!window.confirm(`¿Liberar la boleta ${number}? Esta acción se puede volver a crear después.`)) {
    return;
  }

  elements.deleteTicketButton.disabled = true;

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", ticketId);

  elements.deleteTicketButton.disabled = false;

  if (error) {
    showToast(`No se pudo liberar la boleta: ${error.message}`, true);
    return;
  }

  closeDialog(elements.ticketModal);
  await loadTickets();
  showToast(`Boleta ${number} liberada.`);
}

function openClientPaymentModal(buyer) {
  if (!canModifyTickets()) return;

  if (!activeRaffle || !elements.clientPaymentModal) {
    showToast("No se encontró el modal de confirmación.", true);
    return;
  }

  const pendingTickets = tickets
    .filter((ticket) => ticket.buyer.trim() === buyer && !ticket.is_paid)
    .map((ticket) => ticket.number);

  if (!pendingTickets.length) {
    showToast("Este cliente no tiene boletas pendientes.");
    return;
  }

  pendingClientPaymentBuyer = buyer;

  elements.clientPaymentDetails.textContent =
    `Cliente: ${buyer}. Boletas pendientes: ${pendingTickets.join(", ")}.`;

  showDialog(elements.clientPaymentModal);
}

async function markClientTicketsAsPaid(buyer) {
  if (!canModifyTickets()) return false;

  const pendingTickets = tickets.filter(
    (ticket) => ticket.buyer.trim() === buyer && !ticket.is_paid
  );

  if (!pendingTickets.length) {
    showToast("Este cliente no tiene boletas pendientes.");
    return false;
  }

  const { error } = await supabase
    .from("tickets")
    .update({ is_paid: true })
    .eq("raffle_id", activeRaffle.id)
    .eq("buyer", buyer)
    .eq("is_paid", false);

  if (error) {
    showToast(`No se pudieron actualizar las boletas: ${error.message}`, true);
    return false;
  }

  await loadTickets();
  showToast(`Se marcaron ${pendingTickets.length} boleta(s) como pagadas.`);
  return true;
}

elements.newRaffleButton.addEventListener("click", () => {
  requireAdmin(() => showDialog(elements.raffleModal));
});

elements.lockButton.addEventListener("click", () => {
  sessionStorage.removeItem(CONFIG.sessionKey);
  updateLockButton();
  showToast("Acceso administrativo bloqueado.");
});

elements.raffleSelect.addEventListener("change", (event) => {
  setActiveRaffle(event.target.value);
});

elements.raffleForm.addEventListener("submit", createRaffle);
elements.clientsSearch.addEventListener("input", renderClients);
elements.editRaffleButton.addEventListener("click", () => {
  requireAdmin(openEditRaffleModal);
});
elements.editRaffleForm.addEventListener("submit", saveRaffleName);
elements.finishRaffleButton.addEventListener("click", () => {
  requireAdmin(openFinishRaffleModal);
});
elements.finishRaffleForm.addEventListener("submit", finishRaffle);
elements.ticketForm.addEventListener("submit", saveTicket);
elements.deleteTicketButton.addEventListener("click", deleteTicket);
elements.downloadImageButton.addEventListener("click", downloadRaffleImage);
elements.pinForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (elements.pinInput.value !== CONFIG.adminPin) {
    showToast("PIN incorrecto.", true);
    elements.pinInput.select();
    return;
  }

  sessionStorage.setItem(CONFIG.sessionKey, "true");
  closeDialog(elements.pinModal);
  updateLockButton();

  const action = pendingProtectedAction;
  pendingProtectedAction = null;

  if (action) action();
  showToast("Acceso administrativo habilitado.");
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.close);
    closeDialog(dialog);

    if (dialog === elements.pinModal) {
      pendingProtectedAction = null;
    }
  });
});

if (elements.clientPaymentForm) {
  elements.clientPaymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!pendingClientPaymentBuyer) return;

    elements.confirmClientPaymentButton.disabled = true;

    const completed = await markClientTicketsAsPaid(pendingClientPaymentBuyer);

    elements.confirmClientPaymentButton.disabled = false;

    if (completed) {
      pendingClientPaymentBuyer = null;
      closeDialog(elements.clientPaymentModal);
    }
  });
}

async function init() {
  updateLockButton();

  if (
    CONFIG.supabaseUrl.includes("TU-PROYECTO") ||
    CONFIG.supabaseAnonKey.includes("TU_CLAVE")
  ) {
    showToast("Configura la URL y la clave anon de Supabase en script.js.", true);
    return;
  }

  await loadRaffles();
  subscribeToRaffles();
}

init();
