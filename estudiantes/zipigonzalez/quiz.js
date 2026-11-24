// Datos del proyecto:
// - datos.json: las finales de los Mundiales. Cada final es un registro con los campos
//   id, anio, fecha, sede, local, visitante, golesLocal, golesVisitante, alargue,
//   penales, campeon, goles (lista con minuto, jugador, equipo, penal, enContra) y nota.
// - preguntas.json: preguntas escritas a mano (id, pregunta, opciones, correcta, dato).
// Todo se guarda en memoria: al recargar la página, el juego vuelve a empezar.

const PREGUNTAS_FIJAS = 3; // cuántas preguntas escritas a mano entran en cada partida
const PREGUNTAS_DE_FINALES = 7; // cuántas se arman a partir de las finales

let finales = [];
let preguntasFijas = [];
let preguntas = [];
let actual = 0;
let puntos = 0;

const el = (id) => document.getElementById(id);

// ---------- Ayudas ----------

function mezclar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];
const sinRepetir = (lista) => [...new Set(lista)];

// Arma una pregunta con la respuesta correcta y tres opciones incorrectas, mezcladas.
function armarPregunta(texto, correcta, incorrectas, dato) {
  const otras = mezclar(sinRepetir(incorrectas).filter((x) => x !== correcta)).slice(0, 3);
  const opciones = mezclar([correcta, ...otras]);
  return { pregunta: texto, opciones, correcta: opciones.indexOf(correcta), dato };
}

function marcador(p) {
  let texto = `${p.local} ${p.golesLocal}-${p.golesVisitante} ${p.visitante}`;
  if (p.alargue) texto += " (con alargue)";
  if (p.penales) texto += `, ${p.penales.local}-${p.penales.visitante} por penales`;
  return texto;
}

const resumen = (p) => `Final ${p.anio}, ${p.sede}: ${marcador(p)}. Campeón: ${p.campeon}.`;

// ---------- Preguntas armadas a partir de las finales ----------

const todosLosEquipos = () => sinRepetir(finales.flatMap((p) => [p.local, p.visitante]));
const golesNormales = (p) => p.goles.filter((g) => !g.enContra);

const tiposDePregunta = [
  // ¿Quién ganó?
  (p) =>
    armarPregunta(
      `¿Qué selección ganó la final del Mundial ${p.anio}?`,
      p.campeon,
      [p.local, p.visitante, ...mezclar(todosLosEquipos())],
      resumen(p)
    ),

  // ¿Quién hizo el gol en tal minuto?
  (p) => {
    const goles = golesNormales(p);
    if (!goles.length) return null;
    const g = alAzar(goles);
    const otros = finales.flatMap((x) => golesNormales(x).map((y) => y.jugador)).filter((j) => j !== g.jugador);
    return armarPregunta(
      `En la final de ${p.anio} (${p.local} vs ${p.visitante}), ¿quién hizo el gol de ${g.equipo} en el minuto ${g.minuto}?`,
      g.jugador,
      mezclar(otros),
      resumen(p)
    );
  },

  // ¿En qué minuto?
  (p) => {
    const unicos = golesNormales(p).filter((g) => p.goles.filter((x) => x.jugador === g.jugador).length === 1);
    if (!unicos.length) return null;
    const g = alAzar(unicos);
    const tope = p.alargue ? 120 : 90;
    const incorrectos = [];
    while (incorrectos.length < 3) {
      const m = 1 + Math.floor(Math.random() * tope);
      if (Math.abs(m - g.minuto) >= 5 && !incorrectos.some((x) => Math.abs(x - m) < 5)) incorrectos.push(m);
    }
    return armarPregunta(
      `¿En qué minuto hizo ${g.jugador} su gol en la final de ${p.anio}?`,
      `Minuto ${g.minuto}`,
      incorrectos.map((m) => `Minuto ${m}`),
      resumen(p)
    );
  },

  // ¿Cómo terminó?
  (p) => {
    const real = `${p.golesLocal}-${p.golesVisitante}`;
    const incorrectos = [];
    for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) if (`${a}-${b}` !== real) incorrectos.push(`${a}-${b}`);
    const aclaracion = p.alargue ? " (contando el alargue, sin penales)" : "";
    return armarPregunta(
      `¿Cómo terminó la final de ${p.anio} entre ${p.local} y ${p.visitante}${aclaracion}?`,
      real,
      mezclar(incorrectos),
      resumen(p)
    );
  },

  // ¿Dónde se jugó?
  (p) =>
    armarPregunta(
      `¿En qué ciudad se jugó la final del Mundial ${p.anio}?`,
      p.sede.split(",")[0],
      mezclar(finales.map((x) => x.sede.split(",")[0])),
      resumen(p)
    ),
];

function preguntasDeFinales(cantidad) {
  const resultado = [];
  let intentos = 0;
  while (resultado.length < cantidad && intentos < 100) {
    intentos++;
    const pregunta = alAzar(tiposDePregunta)(alAzar(finales));
    if (pregunta && !resultado.some((x) => x.pregunta === pregunta.pregunta)) resultado.push(pregunta);
  }
  return resultado;
}

// ---------- Juego ----------

function empezar() {
  preguntas = mezclar([
    ...mezclar(preguntasFijas).slice(0, PREGUNTAS_FIJAS),
    ...preguntasDeFinales(PREGUNTAS_DE_FINALES),
  ]);
  actual = 0;
  puntos = 0;
  el("final").hidden = true;
  el("juego").hidden = false;
  mostrarPregunta();
}

function actualizarProgreso() {
  el("progreso").textContent = `Pregunta ${actual + 1} de ${preguntas.length} · Puntos: ${puntos}`;
}

function mostrarPregunta() {
  const p = preguntas[actual];
  actualizarProgreso();
  el("pregunta").textContent = p.pregunta;
  el("mensaje").textContent = "";
  el("siguiente").hidden = true;

  const contenedor = el("opciones");
  contenedor.innerHTML = "";
  p.opciones.forEach((texto, indice) => {
    const boton = document.createElement("button");
    boton.textContent = texto;
    boton.addEventListener("click", () => responder(indice));
    contenedor.appendChild(boton);
  });
}

function responder(elegida) {
  const p = preguntas[actual];
  const botones = el("opciones").querySelectorAll("button");
  botones.forEach((b) => (b.disabled = true));
  botones[p.correcta].classList.add("correcta");

  if (elegida === p.correcta) {
    puntos++;
    el("mensaje").textContent = `✅ ¡Correcto! ${p.dato}`;
  } else {
    botones[elegida].classList.add("incorrecta");
    el("mensaje").textContent = `❌ Era «${p.opciones[p.correcta]}». ${p.dato}`;
  }

  actualizarProgreso();
  const esLaUltima = actual === preguntas.length - 1;
  el("siguiente").textContent = esLaUltima ? "Ver resultado" : "Siguiente";
  el("siguiente").hidden = false;
  el("siguiente").focus();
}

function mostrarFinal() {
  el("juego").hidden = true;
  el("final").hidden = false;
  const total = preguntas.length;
  const porcentaje = Math.round((puntos / total) * 100);
  let frase = "¡A seguir practicando!";
  if (porcentaje === 100) frase = "¡Perfecto! Sos un crack. 🏆";
  else if (porcentaje >= 70) frase = "¡Muy bien jugado! 👏";
  else if (porcentaje >= 40) frase = "Nada mal, ¡vas por buen camino!";
  el("progreso").textContent = "Fin del partido";
  el("resultado").textContent = `Acertaste ${puntos} de ${total} (${porcentaje}%). ${frase}`;
}

el("siguiente").addEventListener("click", () => {
  actual++;
  if (actual < preguntas.length) mostrarPregunta();
  else mostrarFinal();
});
el("reiniciar").addEventListener("click", empezar);

// ---------- Vista de finales ----------

function crear(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

function tarjetaDePartido(p) {
  const tarjeta = crear("article", "tarjeta");
  tarjeta.appendChild(crear("p", "cabecera", `Mundial ${p.anio} · ${p.sede}`));

  const marcadorNodo = crear("p", "marcador");
  marcadorNodo.append(
    crear("span", p.campeon === p.local ? "ganador" : "", p.local),
    ` ${p.golesLocal} - ${p.golesVisitante} `,
    crear("span", p.campeon === p.visitante ? "ganador" : "", p.visitante)
  );
  tarjeta.appendChild(marcadorNodo);

  const extras = [];
  if (p.alargue) extras.push("con alargue");
  if (p.penales) extras.push(`penales ${p.penales.local}-${p.penales.visitante}`);
  extras.push(`🏆 ${p.campeon}`);
  tarjeta.appendChild(crear("p", "extras", extras.join(" · ")));

  if (p.goles.length) {
    const lista = crear("ul", "goles");
    for (const g of p.goles) {
      let detalle = `${g.jugador} (${g.equipo})`;
      if (g.penal) detalle += " · penal";
      if (g.enContra) detalle += " · en contra";
      const item = crear("li");
      item.append(crear("span", "minuto", `${g.minuto}'`), detalle);
      lista.appendChild(item);
    }
    tarjeta.appendChild(lista);
  } else {
    tarjeta.appendChild(crear("p", "extras", "Sin goles."));
  }

  if (p.nota) tarjeta.appendChild(crear("p", "nota", p.nota));
  return tarjeta;
}

function mostrarFinales() {
  const equipo = el("filtro").value;
  const filtradas = finales
    .filter((p) => !equipo || p.local === equipo || p.visitante === equipo)
    .sort((a, b) => b.anio - a.anio);

  // Cálculo con los datos: títulos por selección (o el récord en finales de una selección).
  if (equipo) {
    const ganadas = filtradas.filter((p) => p.campeon === equipo).length;
    el("titulos").textContent = `${equipo} jugó ${filtradas.length} final(es) y ganó ${ganadas}.`;
  } else {
    // FIFA cuenta los títulos de Alemania Federal como de Alemania.
    const conteo = {};
    for (const p of finales) {
      const campeon = p.campeon === "Alemania Federal" ? "Alemania" : p.campeon;
      conteo[campeon] = (conteo[campeon] || 0) + 1;
    }
    const ranking = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    el("titulos").textContent =
      "Títulos: " + ranking.map(([e, n]) => `${e} ${n}`).join(" · ") + " (Alemania incluye a Alemania Federal).";
  }

  const lista = el("lista-partidos");
  lista.innerHTML = "";
  filtradas.forEach((p) => lista.appendChild(tarjetaDePartido(p)));
}

function llenarFiltro() {
  for (const equipo of todosLosEquipos().sort((a, b) => a.localeCompare(b, "es"))) {
    const opcion = crear("option", "", equipo);
    opcion.value = equipo;
    el("filtro").appendChild(opcion);
  }
}

el("filtro").addEventListener("change", mostrarFinales);

// ---------- Pestañas ----------

function mostrarVista(cual) {
  el("vista-jugar").hidden = cual !== "jugar";
  el("vista-partidos").hidden = cual !== "partidos";
  el("tab-jugar").classList.toggle("activa", cual === "jugar");
  el("tab-partidos").classList.toggle("activa", cual === "partidos");
}
el("tab-jugar").addEventListener("click", () => mostrarVista("jugar"));
el("tab-partidos").addEventListener("click", () => mostrarVista("partidos"));

// ---------- Carga de datos ----------

Promise.all([
  fetch("datos.json").then((r) => r.json()),
  fetch("preguntas.json").then((r) => r.json()),
])
  .then(([datosFinales, datosPreguntas]) => {
    finales = datosFinales;
    preguntasFijas = datosPreguntas;
    llenarFiltro();
    mostrarFinales();
    empezar();
  })
  .catch(() => {
    el("progreso").textContent =
      "No se pudieron cargar los datos. Si abriste el archivo con doble clic, probalo con un servidor local.";
  });
