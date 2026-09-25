// MMA Gauntlet — minigioco a scelte multiple: arrivare a 30-0 senza
// finire KO, senza farsi tagliare dal roster e senza squalifiche.

import { renderChrome } from "./common.js?v=202609250738";

// Una carriera vera dura un numero finito di turni, non un numero di vittorie:
// arrivare in fondo imbattuto e' il vero obiettivo del 30-0.
const MAX_TURNI = 30;
// Sopra questa soglia di Aura si sbloccano le scelte speciali di alcuni scenari.
const SOGLIA_AURA = 60;

const URL_GIOCO = "https://gr-build.github.io/FightItalia/gauntlet.html";

const PERSONAGGI = [
  {
    id: "striker",
    nome: "Striker Killer",
    emoji: "🥊",
    eta: 24,
    tagline: "Vivi di KO o vivi di niente. Mento onesto, ma quando rischi, rischi con stile.",
    stats: { mento: 65, hype: 65, aura: 55 },
    perk: { tipo: "winChanceRischiosa", valore: 10 },
    perkTesto: "+10% probabilità di vittoria nei combattimenti",
  },
  {
    id: "wrestler",
    nome: "Macchina da Wrestling",
    emoji: "🤼",
    eta: 28,
    tagline: "Dodici minuti sulla rete non ti spaventano. Il pubblico si annoia, tu no.",
    stats: { mento: 80, hype: 50, aura: 45 },
    perk: { tipo: "mentoResistenza", valore: 0.7 },
    perkTesto: "-30% di danni al Mento in ogni scenario",
  },
  {
    id: "showman",
    nome: "Showman",
    emoji: "🎤",
    eta: 26,
    tagline: "Luci, microfoni, titoli sui giornali: sono tuoi ancora prima di combattere.",
    stats: { mento: 55, hype: 70, aura: 65 },
    perk: { tipo: "auraBonus", valore: 1.3 },
    perkTesto: "+30% su ogni guadagno di Aura",
  },
  {
    id: "veterano",
    nome: "Veterano Silenzioso",
    emoji: "🧠",
    eta: 34,
    tagline: "Non urli, non balli, non ti serve. Dana ti rispetta anche quando stai zitto.",
    stats: { mento: 70, hype: 60, aura: 50 },
    perk: { tipo: "hypeResistenza", valore: 0.7 },
    perkTesto: "-30% di danni all'Hype in ogni scenario",
  },
];

// Ogni 3 turni la carriera avanza di un anno: un veterano che gioca a
// lungo invecchia sul serio, non solo sulla carta.
const TURNI_PER_ANNO = 3;

function etaCorrente() {
  return personaggioAttivo.eta + Math.floor((stato.incontro - 1) / TURNI_PER_ANNO);
}

const SCENARI = [
  {
    id: "short-notice",
    contesto: "La chiamata",
    testo:
      "Sono le 3 di notte e sul display c'è scritto Dana White. «Mi serve un nome vero per sabato, contro Shavkat Rakhmonov. Hai 4 giorni.»",
    scelte: [
      {
        label: "Accetti: è l'occasione della vita",
        effetti: { hype: 18, aura: 8, mento: -12 },
        esito: "Firmi il contratto in vocale. Zero camp, zero peso fatto, ma da domani tutto il roster sa come ti chiami.",
      },
      {
        label: "Rifiuti: quattro giorni non sono seri",
        effetti: { hype: -16, mento: 8 },
        esito: "«Ok campione, ci risentiamo.» Non ti richiama per tre mesi. Il tuo corpo però ringrazia.",
      },
      {
        label: "Rispondi solo «Booked.» e riattacchi",
        special: true,
        effetti: { hype: 25, aura: 15, mento: -6 },
        esito: "Lo screenshot della chiamata di 4 secondi fa il giro di X in venti minuti. Sei già leggenda prima del match.",
      },
    ],
  },
  {
    id: "weight-cut",
    contesto: "Weigh-in",
    testo:
      "Mancano 4 ore alla bilancia e sei sopra di 3 kg. La sauna ti aspetta. Ma nel frigo c'è anche la pizza che ti ha lasciato Paddy Pimblett.",
    scelte: [
      {
        label: "Sauna estrema, tagli tutto",
        effetti: { mento: -22, hype: 6 },
        esito: "Fai peso per 50 grammi. Sudi anche l'anima e cammini come un fantasma, ma sei in regola.",
      },
      {
        label: "Te ne freghi e mangi la pizza",
        effetti: { hype: -18, mento: 12, aura: 10 },
        esito: "Sali sopra il limite, multa del 20% della borsa. Il pubblico però ti adora: finalmente uno sincero.",
      },
    ],
  },
  {
    id: "conferenza",
    contesto: "Conferenza stampa",
    testo:
      "Il tuo avversario passa dieci minuti a insultare le tue scarpe, la tua palestra e tre generazioni della tua famiglia. Le telecamere sono tutte su di te.",
    scelte: [
      {
        label: "Gli lanci una bottiglietta, stile Diaz",
        effetti: { hype: 20, aura: 12, mento: -5 },
        esito: "Il video supera i 10 milioni di visualizzazioni. La commissione atletica meno entusiasta, ma i biglietti volano.",
      },
      {
        label: "Rispondi citando Marco Aurelio",
        effetti: { aura: 18, hype: -4 },
        esito: "Nessuno in sala capisce la citazione. Sembri comunque l'unico adulto presente nella stanza.",
      },
      {
        label: "Lo fissi in silenzio per dieci secondi e te ne vai",
        special: true,
        effetti: { aura: 22, hype: 12 },
        esito: "Il silenzio diventa una GIF. Hai vinto la conferenza senza pronunciare una sola parola.",
      },
    ],
  },
  {
    id: "gabbia",
    contesto: "Nell'ottagono",
    testo:
      "Terzo round, sei stremato. Un wrestler daghestano ti ha tenuto sulla rete per dodici minuti e ha ancora il fiato di uno che ha appena parcheggiato.",
    scelte: [
      {
        label: "Ginocchiata volante disperata",
        fight: true,
        winChance: 42,
        vittoria: {
          mento: -8,
          hype: 24,
          aura: 12,
          testo: "La ginocchiata arriva pulitissima. KO. Lo stadio esplode e la clip diventa il tuo biglietto da visita per sempre.",
        },
        sconfitta: {
          mento: -28,
          hype: -6,
          testo: "Salti, lui ti prende al volo e ti pianta nel tappeto. Bellissimo su Instagram, disastroso sul cartellino.",
        },
      },
      {
        label: "Ti fai schiacciare sulla rete e perdi ai punti",
        esitoIncontro: "sconfitta",
        effetti: { mento: -6, hype: -8 },
        esito: "Decisione unanime contro. Zero danni cerebrali, zero gloria: esci sulle tue gambe con una sconfitta noiosa.",
      },
    ],
  },
  {
    id: "integratore",
    contesto: "Fuori dalla palestra",
    testo:
      "Un tizio con gli occhiali da sole di notte ti offre «un integratore particolare» per il prossimo camp. Dice che non lo trova nessun test.",
    scelte: [
      {
        label: "Lo prendi: servono risultati",
        instaGameOver: { causa: "usada", chance: 0.28 },
        effetti: { hype: 15, aura: 10, mento: 10 },
        esito: "Il camp migliore della tua vita. Nessuno fa domande. Per ora.",
      },
      {
        label: "Rifiuti e torni ad allenarti",
        effetti: { mento: 6, aura: 6 },
        esito: "Niente scorciatoie. Dormi tranquillo, che nell'MMA moderno vale più di un ciclo.",
      },
    ],
  },
  {
    id: "titolo",
    contesto: "Title fight",
    testo:
      "Sei lo sfidante al titolo. Cinque round, luci accecanti, la cintura appoggiata su un tavolino a due metri da te.",
    scelte: [
      {
        label: "All-in dal gong: vuoi il KO da campione",
        fight: true,
        winChance: 46,
        vittoria: {
          mento: -14,
          hype: 32,
          aura: 18,
          testo: "Lo spegni nel secondo round. Ti mettono la cintura addosso e non senti più niente per dieci minuti.",
        },
        sconfitta: {
          mento: -30,
          hype: -10,
          testo: "Vai a vuoto, lui no. Ti sveglia il dottore mentre chiedi in che round sei.",
        },
      },
      {
        label: "Gestisci i cinque round con pazienza",
        fight: true,
        winChance: 56,
        vittoria: {
          mento: -10,
          hype: 14,
          aura: 4,
          testo: "Decisione divisa a tuo favore. Non è stato bello, ma il cinturone pesa uguale.",
        },
        sconfitta: {
          mento: -16,
          hype: -12,
          testo: "Perdi 48-47 su tutti i cartellini. A casa tutti giurano che avevi vinto tu.",
        },
      },
    ],
  },
  {
    id: "debuttante",
    contesto: "Matchmaking",
    testo:
      "Ti mettono davanti un prospetto di vent'anni al debutto. Ha passato tre settimane a dirti vecchio sui social ed è imbattuto.",
    scelte: [
      {
        label: "Lo sottovaluti e vai a menare",
        fight: true,
        winChance: 40,
        vittoria: {
          mento: -6,
          hype: 20,
          aura: 14,
          testo: "Lo spedisci a dormire in 90 secondi e gli rubi pure il soprannome. Lezione di rispetto completata.",
        },
        sconfitta: {
          mento: -26,
          hype: -14,
          testo: "Il ragazzino ti passa sopra. Il tuo highlight diventa il suo highlight.",
        },
      },
      {
        label: "Lo studi e combatti il tuo match",
        fight: true,
        winChance: 62,
        vittoria: {
          mento: -8,
          hype: 8,
          testo: "Vittoria ai punti senza sbavature. Noiosa per i fan, perfetta per il tuo record.",
        },
        sconfitta: {
          mento: -14,
          hype: -10,
          testo: "Hai fatto tutto giusto per quindici minuti. Lui ha fatto una cosa giusta e gli è bastata.",
        },
      },
    ],
  },
  {
    id: "podcast",
    contesto: "Media day",
    testo:
      "Ti invitano al podcast più ascoltato d'America. Tre ore di diretta e la prima domanda è sulla tua vita privata.",
    scelte: [
      {
        label: "Ti apri e racconti tutto",
        effetti: { hype: 16, mento: 5, aura: -8 },
        esito: "L'intervista commuove mezzo internet. Il tuo prossimo avversario però ha appena preso appunti.",
      },
      {
        label: "Resti sul personaggio, zero informazioni",
        effetti: { aura: 12, hype: -3 },
        esito: "Tre ore di risposte monosillabiche. Il mito cresce proprio perché nessuno sa niente di te.",
      },
    ],
  },
  {
    id: "infortunio",
    contesto: "Camp",
    testo:
      "Ti svegli con la spalla che fa un rumore che non dovrebbe fare. Il match è tra tre settimane e i biglietti sono già venduti.",
    scelte: [
      {
        label: "Combatti lo stesso, non si rimanda niente",
        effetti: { mento: -16, hype: 8, aura: 6 },
        esito: "Infiltrazione, nastro e avanti. La spalla regge. Probabilmente.",
      },
      {
        label: "Chiedi il rinvio del match",
        effetti: { hype: -14, mento: 16 },
        esito: "Il matchmaker non la prende benissimo. Tu però arrivi al prossimo camp con due braccia funzionanti.",
      },
    ],
  },
  {
    id: "sponsor",
    contesto: "Business",
    testo:
      "Un energy drink ti offre un assegno a sei cifre. Unica condizione: berlo in ogni intervista, anche dopo aver preso 40 gomitate.",
    scelte: [
      {
        label: "Firmi: i soldi sono soldi",
        effetti: { hype: 12, mento: 6, aura: -10 },
        esito: "Ora hai il logo sul petto e il frigo pieno. I puristi ti scrivono che ti sei venduto.",
      },
      {
        label: "Rifiuti: non ti rappresenta",
        effetti: { aura: 12, hype: -5 },
        esito: "Niente assegno, ma la tua faccia non finisce su una lattina. I fan duri e puri applaudono.",
      },
    ],
  },
  {
    id: "vendetta",
    contesto: "Rivincita",
    testo:
      "Davanti a te c'è di nuovo quello che ti ha steso l'anno scorso. Ti sorride mentre il referee spiega le regole.",
    scelte: [
      {
        label: "Vai a prendertela con rabbia",
        fight: true,
        winChance: 44,
        vittoria: {
          mento: -12,
          hype: 26,
          aura: 16,
          testo: "Lo ribalti nel primo round e resti a fissarlo mentre è a terra. Vendetta consumata in diretta mondiale.",
        },
        sconfitta: {
          mento: -27,
          hype: -8,
          testo: "La rabbia ti mangia il piano gara. Stesso finale dell'anno scorso, stesso soffitto da guardare.",
        },
      },
      {
        label: "Testa fredda, esegui il piano del coach",
        fight: true,
        winChance: 58,
        vittoria: {
          mento: -9,
          hype: 12,
          aura: 8,
          testo: "Tre round chirurgici. Niente show, solo la mano alzata e un conto in sospeso finalmente chiuso.",
        },
        sconfitta: {
          mento: -15,
          hype: -10,
          testo: "Hai fatto tutto giusto tranne vincere. Il coach ti abbraccia lo stesso.",
        },
      },
    ],
  },
  {
    id: "coach",
    contesto: "Palestra",
    testo:
      "A due settimane dal match il tuo coach decide che devi cambiare completamente stile. «Da oggi sei un wrestler.»",
    scelte: [
      {
        label: "Ti fidi ciecamente del coach",
        effetti: { mento: -10, aura: 10 },
        esito: "Due settimane a farti mettere a terra dai compagni. Qualcosa però hai imparato.",
      },
      {
        label: "Ti opponi e resti fedele al tuo stile",
        effetti: { hype: -6, mento: 12 },
        esito: "Discussione accesa in palestra. Alla fine combatti come sai fare tu, che è anche come sai vincere tu.",
      },
    ],
  },
  {
    id: "instagram",
    contesto: "Social",
    testo:
      "Il tuo prossimo avversario ti sta tempestando di commenti sotto ogni post. Ha anche fatto un meme con la tua faccia. Fa ridere, purtroppo.",
    scelte: [
      {
        label: "Rispondi colpo su colpo nei commenti",
        effetti: { aura: 14, hype: 10, mento: -6 },
        esito: "Il botta e risposta finisce sui siti di settore. Il match adesso lo vogliono vedere tutti.",
      },
      {
        label: "Ignori e parli solo in gabbia",
        effetti: { aura: 6, mento: 8 },
        esito: "Silenzio totale per tre settimane. Il tuo camp è il migliore da anni.",
      },
    ],
  },
  {
    id: "gatekeeper",
    contesto: "Main card",
    testo:
      "Contro di te c'è il veterano che ha fatto fuori mezza divisione di prospetti come te. Ha 41 anni, un mento di marmo e zero paura.",
    scelte: [
      {
        label: "Provi a metterlo sotto e finirlo presto",
        fight: true,
        winChance: 45,
        vittoria: {
          mento: -11,
          hype: 22,
          aura: 12,
          testo: "Lo fermi al secondo round. Il veterano ti stringe la mano: adesso il gatekeeper sei tu.",
        },
        sconfitta: {
          mento: -25,
          hype: -10,
          testo: "Assorbe tutto e ti aspetta. Nel terzo round il mento di marmo diventa un problema tuo.",
        },
      },
      {
        label: "Lo porti alla distanza e rubi i round",
        fight: true,
        winChance: 60,
        vittoria: {
          mento: -7,
          hype: 9,
          testo: "Tre round di jab e movimento. Vittoria pulita e zero danni da portarti a casa.",
        },
        sconfitta: {
          mento: -13,
          hype: -11,
          testo: "Split decision contro. I giudici hanno premiato l'aggressività, non la precisione.",
        },
      },
    ],
  },
  {
    id: "famiglia",
    contesto: "Casa",
    testo:
      "Tua madre ti chiama in lacrime dopo aver visto l'ultimo highlight. «Basta, è troppo pericoloso, smetti.»",
    scelte: [
      {
        label: "La rassicuri e continui",
        effetti: { mento: 10, hype: 3 },
        esito: "Un'ora al telefono. Riattacchi più leggero e con la sensazione di avere qualcosa per cui combattere.",
      },
      {
        label: "Prometti che valuterai il ritiro",
        effetti: { mento: 16, hype: -12 },
        esito: "Dormi benissimo per la prima volta da mesi. Il tuo manager, informato, dorme molto peggio.",
      },
    ],
  },
  {
    id: "callout",
    contesto: "Post-match",
    testo:
      "Microfono in mano nell'ottagono, 20.000 persone in attesa. Puoi chiamare chiunque, anche chi è dieci posizioni sopra di te.",
    scelte: [
      {
        label: "Chiami il campione per nome e cognome",
        effetti: { hype: 20, aura: 14, mento: -4 },
        esito: "Il campione si alza dalla prima fila e ti applaude ironicamente. La macchina dell'hype è partita.",
      },
      {
        label: "Ringrazi il team e chiedi solo il prossimo match",
        effetti: { hype: -6, mento: 8, aura: 4 },
        esito: "Professionale, educato, dimenticato in dodici ore. Il matchmaker però ti apprezza.",
      },
      {
        label: "Fai una promessa assurda: «Trenta e zero, poi mi ritiro»",
        special: true,
        effetti: { hype: 26, aura: 18, mento: -8 },
        esito: "La frase diventa un titolo su ogni sito MMA del pianeta. Adesso però devi mantenerla.",
      },
    ],
  },
  {
    id: "submission-specialist",
    contesto: "Ground game",
    testo:
      "Il tuo avversario è una cintura nera di jiu-jitsu che sorride ogni volta che il match finisce a terra. Sembra invitarti a giocare al suo gioco.",
    scelte: [
      {
        label: "Resti in piedi a tutti i costi, eviti il tappeto",
        fight: true,
        winChance: 55,
        vittoria: { mento: -8, hype: 16, testo: "Non tocchi terra per tre round. Lui si innervosisce sempre di più, tu vinci ai punti." },
        sconfitta: { mento: -14, hype: -8, testo: "Un takedown fortunato nell'ultimo minuto e sei sotto una chiave al braccio. Batti giusto in tempo." },
      },
      {
        label: "Lo sfidi a terra, gioco suo contro gioco suo",
        fight: true,
        winChance: 38,
        vittoria: { mento: -10, hype: 28, aura: 16, testo: "Lo sottometti al suo gioco. Il pubblico impazzisce, lui non ci crede." },
        sconfitta: { mento: -20, hype: -10, testo: "Batti dopo due minuti di sofferenza pura. Errore di matchmaking, il tuo." },
      },
    ],
  },
  {
    id: "southpaw",
    contesto: "Stile ostico",
    testo:
      "Il tuo avversario è mancino, tecnico, e ti ha già steso in allenamento anni fa quando eravate compagni di palestra.",
    scelte: [
      {
        label: "Cambi guardia per confonderlo",
        fight: true,
        winChance: 50,
        vittoria: { mento: -9, hype: 14, testo: "La guardia invertita lo spiazza per un round intero. Basta per vincere ai punti." },
        sconfitta: { mento: -18, hype: -6, testo: "Ti senti scomodo per tutto il match. Lui, a casa sua, vince comodo." },
      },
      {
        label: "Ignori lo stile, vai di potenza",
        fight: true,
        winChance: 46,
        vittoria: { mento: -12, hype: 20, aura: 8, testo: "La potenza pareggia la tecnica. Lo fermi al secondo round." },
        sconfitta: { mento: -22, hype: -8, testo: "La tecnica batte la potenza, come sempre contro i mancini bravi." },
      },
    ],
  },
  {
    id: "casa-sua",
    contesto: "Trasferta",
    testo: "Combatti nel paese del tuo avversario, davanti a 18.000 persone che urlano solo il suo nome.",
    scelte: [
      {
        label: "Provi a zittire la folla dal primo minuto",
        fight: true,
        winChance: 42,
        vittoria: { mento: -10, hype: 22, aura: 14, testo: "Un minuto di silenzio assoluto in uno stadio pieno. Il suono più bello della tua carriera." },
        sconfitta: { mento: -24, hype: -10, testo: "La folla esplode, tu no. Torni a casa con un volo silenzioso." },
      },
      {
        label: "Giochi sporco sui tempi, rallenti il match",
        fight: true,
        winChance: 60,
        vittoria: { mento: -8, hype: 6, testo: "Vittoria ai punti tra i fischi. A te va bene lo stesso." },
        sconfitta: { mento: -14, hype: -14, testo: "Anche rallentando perdi. E ti fischiano pure più forte." },
      },
    ],
  },
  {
    id: "campione-uscente",
    contesto: "Ultima chance",
    testo:
      "Il campione appena detronizzato ti sceglie per la sua ultima corsa verso il titolo. Vuole dimostrare che non è finito.",
    scelte: [
      {
        label: "Lo tratti come un fantasma del passato",
        fight: true,
        winChance: 52,
        vittoria: { mento: -9, hype: 24, aura: 10, testo: "Chiudi la sua carriera in tre round. La storia si scrive anche così." },
        sconfitta: { mento: -20, hype: -6, testo: "Il fantasma morde ancora. Torna in corsa per il titolo, tu no." },
      },
      {
        label: "Lo rispetti ma non ti fai intimidire",
        fight: true,
        winChance: 58,
        vittoria: { mento: -10, hype: 16, testo: "Decisione pulita. Lui si ritira sul serio stavolta, tu resti in corsa." },
        sconfitta: { mento: -16, hype: -8, testo: "L'esperienza vince ancora una volta sulla gioventù." },
      },
    ],
  },
  {
    id: "colpo-basso",
    contesto: "Incidente di percorso",
    testo:
      "Nel mezzo del secondo round il tuo avversario ti tira un colpo chiaramente sotto la cintura. L'arbitro non lo vede.",
    scelte: [
      {
        label: "Ti fermi e chiedi il time-out per il dolore",
        effetti: { mento: 8, hype: -6 },
        esito: "Recuperi cinque minuti preziosi. Il pubblico fischia, il tuo fisico ringrazia.",
      },
      {
        label: "Stringi i denti e continui come se niente fosse",
        fight: true,
        winChance: 48,
        vittoria: { mento: -14, hype: 22, aura: 10, testo: "Il dolore diventa carburante. Lo finisci nel round successivo." },
        sconfitta: { mento: -24, hype: -8, testo: "Il dolore vince lui. Il match, molto meno onestamente, resta suo." },
      },
    ],
  },
  {
    id: "mano-rotta",
    contesto: "Infortunio in gara",
    testo: "Al primo round senti la mano destra scricchiolare dopo un gancio a vuoto sul gomito del tuo avversario.",
    scelte: [
      {
        label: "Cambi tutto sulla sinistra per il resto del match",
        fight: true,
        winChance: 44,
        vittoria: { mento: -10, hype: 18, aura: 10, testo: "Il tuo sinistro improvvisato basta. Vittoria da mancino per un giorno." },
        sconfitta: { mento: -20, hype: -8, testo: "Combattere con una mano sola contro un professionista non funziona quasi mai." },
      },
      {
        label: "Chiedi al medico di valutare lo stop",
        esitoIncontro: "sconfitta",
        effetti: { mento: -4, hype: -10 },
        esito: "Il match viene fermato per infortunio. Sconfitta tecnica, ma la mano si salva per il prossimo camp.",
      },
    ],
  },
  {
    id: "prospect-hype",
    contesto: "Aspettative",
    testo: "I bookmaker ti danno sfavorito 4 a 1 contro un prospetto pompato dai social più di quanto meriti.",
    scelte: [
      {
        label: "Giochi con la sua sicurezza, lo provochi",
        fight: true,
        winChance: 47,
        vittoria: { mento: -9, hype: 24, aura: 14, testo: "Crolla mentalmente prima ancora che fisicamente. Upset completato." },
        sconfitta: { mento: -18, hype: -10, testo: "L'hype aveva ragione stavolta. Amaro ma sportivo." },
      },
      {
        label: "Lasci parlare solo la tecnica",
        fight: true,
        winChance: 53,
        vittoria: { mento: -8, hype: 18, testo: "Lezione di boxe pura. I bookmaker si sbagliavano." },
        sconfitta: { mento: -16, hype: -9, testo: "Il talento grezzo batte l'esperienza, oggi." },
      },
    ],
  },
  {
    id: "cambio-categoria",
    contesto: "Decisione di carriera",
    testo: "Il tuo manager ti propone di salire di categoria di peso per trovare avversari più freschi.",
    scelte: [
      {
        label: "Sali di categoria",
        effetti: { mento: 14, hype: -6 },
        esito: "Più cibo, più energia, meno tagli assurdi. Ti senti un'altra persona (letteralmente più pesante).",
      },
      {
        label: "Resti dove sei, hai un record da difendere",
        effetti: { hype: 6, aura: 4 },
        esito: "Resti il pesce grosso nella tua vasca. Per ora.",
      },
    ],
  },
  {
    id: "documentario",
    contesto: "Netflix",
    testo: "Una troupe ti segue per un documentario sportivo. Le telecamere sono ovunque, quasi anche in bagno.",
    scelte: [
      {
        label: "Ti apri completamente alle telecamere",
        effetti: { hype: 18, aura: -6, mento: 4 },
        esito: "L'episodio diventa virale. Anche tua nonna ora sa chi sei.",
      },
      {
        label: "Limiti l'accesso, resti riservato",
        effetti: { aura: 10, hype: -4 },
        esito: "Il documentario è più corto del previsto ma tu resti un mistero, e i misteri vendono.",
      },
    ],
  },
  {
    id: "scommesse",
    contesto: "Voci di corridoio",
    testo:
      "Un giornalista ti chiede se è vero che hai scommesso contro te stesso nell'ultimo match. Non è vero, ma la domanda resta lì.",
    scelte: [
      {
        label: "Rispondi con rabbia e neghi tutto",
        effetti: { hype: -8, mento: -6, aura: 8 },
        esito: "La rabbia sembra sincera perché lo è. Ma i titoli di domani parlano solo di quello.",
      },
      {
        label: "Ridi e cambi argomento con classe",
        effetti: { aura: 14, hype: 4 },
        esito: "La domanda muore lì. La tua calma vale più di mille smentite.",
      },
    ],
  },
  {
    id: "allenamento-leggenda",
    contesto: "Camp",
    testo: "Una leggenda ritirata dell'MMA passa in palestra e ti offre due settimane di sparring gratuito.",
    scelte: [
      {
        label: "Accetti, vuoi imparare dai migliori",
        effetti: { mento: 10, aura: 12, hype: 4 },
        esito: "Due settimane di lividi e consigli che valgono più di qualsiasi camp normale.",
      },
      {
        label: "Rifiuti, hai già il tuo metodo",
        effetti: { mento: 6, hype: -2 },
        esito: "Resti fedele al tuo angolo. Rispettabile, forse un po' testardo.",
      },
    ],
  },
  {
    id: "rivale-social",
    contesto: "Beef digitale",
    testo: "Il tuo ex compagno di palestra, ora rivale, pubblica una storia in cui ti definisce «finito».",
    scelte: [
      {
        label: "Rispondi con un video di allenamento brutale",
        effetti: { hype: 14, aura: 10, mento: -4 },
        esito: "Il video parla da solo. I commenti sono tutti dalla tua parte.",
      },
      {
        label: "Non rispondi, lascia parlare i fatti in gabbia",
        effetti: { aura: 8, mento: 8 },
        esito: "Il silenzio pesa più di qualsiasi replica. Lui continua a postare, tu continui ad allenarti.",
      },
    ],
  },
  {
    id: "problema-visto",
    contesto: "Burocrazia",
    testo: "Il tuo visto per combattere all'estero ha un problema last minute. L'evento è a rischio per colpa tua.",
    scelte: [
      {
        label: "Voli comunque e speri in un miracolo in aeroporto",
        effetti: { mento: -10, hype: 8 },
        esito: "Passi il controllo per un soffio. Il camp perso in aeroporto però si sente.",
      },
      {
        label: "Comunichi il problema e chiedi supporto legale allo staff",
        effetti: { hype: -10, mento: 10 },
        esito: "Il problema si risolve in 48 ore grazie all'avvocato dell'organizzazione. Lezione: fidati dello staff.",
      },
    ],
  },
  {
    id: "premio",
    contesto: "Gala",
    testo: "Ti invitano a una premiazione di fine anno. Devi solo sorridere per le foto e ringraziare lo sponsor principale.",
    scelte: [
      {
        label: "Fai un discorso lungo e sentito",
        effetti: { hype: 10, aura: 6 },
        esito: "Il discorso commuove la sala. Qualcuno pubblica la clip il giorno dopo.",
      },
      {
        label: "Ringrazi in dieci secondi e torni a sederti",
        effetti: { aura: 8, hype: -2 },
        esito: "Essenziale, diretto, memorabile per la sua brevità.",
      },
    ],
  },
  {
    id: "sparring-partner-ko",
    contesto: "Camp",
    testo: "Durante lo sparring stendi per sbaglio il tuo compagno di allenamento più giovane. Non si alza subito.",
    scelte: [
      {
        label: "Ti fermi tutto il giorno, resti con lui in infermeria",
        effetti: { mento: 8, aura: 6, hype: -2 },
        esito: "Lui sta bene. In palestra iniziano a rispettarti anche per questo.",
      },
      {
        label: "Continui l'allenamento, il camp non aspetta",
        effetti: { hype: 6, mento: -6 },
        esito: "Il camp prosegue, ma qualcosa nell'aria della palestra è cambiato.",
      },
    ],
  },
  {
    id: "influencer",
    contesto: "Collaborazione",
    testo: "Un influencer da 5 milioni di follower ti chiede di allenarlo per un video, in cambio di visibilità enorme.",
    scelte: [
      {
        label: "Accetti, la visibilità è oro",
        effetti: { hype: 16, aura: -8 },
        esito: "Il video fa 20 milioni di views. Metà dei commenti chiede chi sei tu, non lui.",
      },
      {
        label: "Rifiuti gentilmente, non è il tuo mondo",
        effetti: { aura: 10, hype: -4 },
        esito: "I puristi apprezzano. L'algoritmo, molto meno.",
      },
    ],
  },
  {
    id: "scadenza-contratto",
    contesto: "Uffici UFC",
    testo: "Il tuo contratto scade tra due match. Il tuo procuratore vuole negoziare ora, da una posizione di forza.",
    scelte: [
      {
        label: "Spingi per rinnovare subito, sicurezza prima di tutto",
        effetti: { hype: 8, mento: 6 },
        esito: "Contratto rinnovato, stipendio stabile. Meno drammatico, molto più sano.",
      },
      {
        label: "Aspetti la scadenza per trattare da free agent",
        effetti: { hype: -6, aura: 10 },
        esito: "Rischioso ma potenzialmente lucrativo. Intanto la tensione cresce a ogni intervista.",
      },
    ],
  },
  {
    id: "meme-virale",
    contesto: "Internet",
    testo: "Una tua espressione facciale a bordo ottagono diventa un meme virale da un giorno all'altro, fuori dal tuo controllo.",
    scelte: [
      {
        label: "Ti prendi in giro da solo, cavalchi il meme",
        effetti: { hype: 16, aura: 10 },
        esito: "Il meme ti rende più simpatico di qualsiasi vittoria recente.",
      },
      {
        label: "Lo ignori completamente, resti serio",
        effetti: { aura: 6, hype: -2 },
        esito: "Il meme muore in una settimana. Tu resti l'unico a non averci riso su.",
      },
    ],
  },
];

const FINALI = {
  ko: {
    titolo: "KO brutale",
    emoji: "💫",
    sottotitolo: "Le luci si spengono",
    testo:
      "Il tuo mento ha staccato prima di te. Ti risvegli con il dottore che ti chiede che giorno è e tre persone che ti dicono di stare giù.",
    frase: "prima di farmi spegnere le luci",
  },
  cut: {
    titolo: "Tagliato dal roster",
    emoji: "✂️",
    sottotitolo: "Dana non risponde più",
    testo:
      "Nessun KO, nessuna squalifica: solo match che non vendevano un biglietto. La mail arriva di lunedì mattina, due righe in tutto.",
    frase: "prima che Dana White smettesse di rispondermi",
  },
  usada: {
    titolo: "Squalifica antidoping",
    emoji: "🧪",
    sottotitolo: "Il test è tornato positivo",
    testo:
      "Quell'integratore particolare non era così particolare. Due anni di stop e un asterisco accanto a ogni vittoria.",
    frase: "prima che l'antidoping bussasse alla porta",
  },
  goat: {
    titolo: "GOAT indiscusso",
    emoji: "🐐",
    sottotitolo: "Carriera completa, mai sconfitto",
    testo:
      "Trenta turni di camp, pressione mediatica e notti in gabbia, zero sconfitte sul groppone. Appoggi i guantoni al centro dell'ottagono e te ne vai imbattuto, senza dare a nessuno la rivincita.",
    frase: "e mi sono ritirato imbattuto",
  },
  "fine-carriera": {
    titolo: "Fine carriera",
    emoji: "🏁",
    sottotitolo: "Trenta turni più tardi",
    testo:
      "Trenta turni tra camp, conferenze stampa e notti in gabbia. Non sei imbattuto, ma sei arrivato fino in fondo sulle tue gambe, ed è già più di quanto riescano in molti.",
    frase: "dopo trenta turni di carriera",
  },
  ritiro: {
    titolo: "Ritiro volontario",
    emoji: "🎙️",
    sottotitolo: "Vai via con le tue gambe",
    testo:
      "Nessuno ti ha steso, nessuno ti ha tagliato. Sei tu a decidere quando basta, mentre sei ancora in piedi per raccontarlo.",
    frase: "e ho scelto io quando smettere",
  },
};

let stato = null;
let personaggioAttivo = null;
let nomeAttivo = "";
let codaScenari = [];
let ultimoScenarioId = null;

const $ = (sel) => document.querySelector(sel);

function clamp(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Il nickname arriva dall'utente: mai iniettarlo come HTML, solo come testo.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderSelezionePersonaggi() {
  $("#personaggi").innerHTML = PERSONAGGI.map(
    (p, i) => `
    <button class="personaggio-card" data-personaggio="${i}">
      <div class="personaggio-emoji">${p.emoji}</div>
      <div class="personaggio-nome">${p.nome} <span class="personaggio-eta">${p.eta} anni</span></div>
      <p class="personaggio-tagline">${p.tagline}</p>
      <div class="personaggio-stats">Mento ${p.stats.mento} · Hype ${p.stats.hype} · Aura ${p.stats.aura}</div>
      <div class="personaggio-perk">${p.perkTesto}</div>
    </button>`
  ).join("");

  $("#personaggi").querySelectorAll("[data-personaggio]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scelto = PERSONAGGI[Number(btn.dataset.personaggio)];
      nuovaPartita(scelto, $("#nickname").value);
    });
  });
}

function mostraSelezionePersonaggio() {
  $("#finale").hidden = true;
  $("#gioco").hidden = true;
  $("#intro").hidden = false;
}

function nuovaPartita(personaggio, nickname = nomeAttivo) {
  personaggioAttivo = personaggio;
  nomeAttivo = (nickname || "").trim().slice(0, 24) || personaggio.nome;
  stato = { ...personaggio.stats, vittorie: 0, sconfitte: 0, incontro: 1, finita: false };
  codaScenari = [];
  ultimoScenarioId = null;
  $("#intro").hidden = true;
  $("#finale").hidden = true;
  $("#gioco").hidden = false;
  $("#personaggio-attivo").textContent = `${personaggio.emoji} ${nomeAttivo}`;
  renderStato();
  nuovoTurno();
}

function renderStato() {
  $("#record").textContent = `${stato.vittorie}-${stato.sconfitte}`;
  $("#turno").textContent = `Turno ${stato.incontro}/${MAX_TURNI}`;
  $("#eta").textContent = `${etaCorrente()} anni`;
  for (const [chiave, id] of [
    ["mento", "barra-mento"],
    ["hype", "barra-hype"],
    ["aura", "barra-aura"],
  ]) {
    const valore = stato[chiave];
    const barra = document.getElementById(id);
    barra.querySelector(".stat-fill").style.width = `${valore}%`;
    barra.querySelector(".stat-valore").textContent = valore;
    barra.classList.toggle("critica", valore <= 25);
  }
  $("#aura-sblocco").hidden = stato.aura < SOGLIA_AURA;
}

// Ogni scenario esce una sola volta prima che il mazzo si rimescoli: su una
// carriera di 30 turni evita che le stesse card tornino troppo in fretta.
function rimescolaScenari() {
  codaScenari = [...SCENARI];
  for (let i = codaScenari.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [codaScenari[i], codaScenari[j]] = [codaScenari[j], codaScenari[i]];
  }
  // Evita che l'ultimo scenario del mazzo precedente ricompaia subito in testa al nuovo.
  if (codaScenari[codaScenari.length - 1].id === ultimoScenarioId && codaScenari.length > 1) {
    const scambio = Math.floor(Math.random() * (codaScenari.length - 1));
    const ultimo = codaScenari.length - 1;
    [codaScenari[ultimo], codaScenari[scambio]] = [codaScenari[scambio], codaScenari[ultimo]];
  }
}

function scegliScenario() {
  if (!codaScenari.length) rimescolaScenari();
  const scenario = codaScenari.pop();
  ultimoScenarioId = scenario.id;
  return scenario;
}

function nuovoTurno() {
  const scenario = scegliScenario();
  const scelte = scenario.scelte.filter((s) => !s.special || stato.aura >= SOGLIA_AURA);

  $("#card").innerHTML = `
    <div class="scenario-tag">${scenario.contesto}</div>
    <p class="scenario-testo">${scenario.testo}</p>
    <div class="scelte">
      ${scelte
        .map(
          (s, i) => `
        <button class="scelta ${s.special ? "speciale" : ""}" data-scelta="${i}">
          ${s.special ? '<span class="scelta-badge">Aura</span>' : ""}
          <span>${s.label}</span>
        </button>`
        )
        .join("")}
    </div>`;

  $("#card").querySelectorAll("[data-scelta]").forEach((btn) => {
    btn.addEventListener("click", () => risolviScelta(scelte[Number(btn.dataset.scelta)]), { once: true });
  });
}

// Ogni personaggio ha un solo perk passivo: attenua i propri punti deboli
// (mento/hype) o amplifica il proprio punto forte (aura). Il bonus alle
// probabilita' di vittoria nei combattimenti si applica invece in risolviScelta.
function aggiustaDeltaPerPersona(chiave, delta) {
  const perk = personaggioAttivo && personaggioAttivo.perk;
  if (!perk) return delta;
  if (perk.tipo === "mentoResistenza" && chiave === "mento" && delta < 0) return delta * perk.valore;
  if (perk.tipo === "hypeResistenza" && chiave === "hype" && delta < 0) return delta * perk.valore;
  if (perk.tipo === "auraBonus" && chiave === "aura" && delta > 0) return delta * perk.valore;
  return delta;
}

function applicaEffetti(effetti = {}) {
  const applicati = {};
  for (const chiave of ["mento", "hype", "aura"]) {
    const delta = effetti[chiave] || 0;
    if (!delta) continue;
    const deltaFinale = Math.round(aggiustaDeltaPerPersona(chiave, delta));
    stato[chiave] = clamp(stato[chiave] + deltaFinale);
    applicati[chiave] = deltaFinale;
  }
  return applicati;
}

function risolviScelta(scelta) {
  if (scelta.instaGameOver && Math.random() < scelta.instaGameOver.chance) {
    return finePartita(scelta.instaGameOver.causa);
  }

  let testo;
  let deltas;
  let esitoIncontro = scelta.esitoIncontro || null;

  if (scelta.fight) {
    // Mento e Aura spostano davvero le probabilita': gestire le barre e' il gioco.
    const bonus = (stato.mento - 50) * 0.3 + (stato.aura - 50) * 0.15;
    const perk = personaggioAttivo.perk;
    const bonusPersona = perk && perk.tipo === "winChanceRischiosa" ? perk.valore : 0;
    const probabilita = Math.max(15, Math.min(85, scelta.winChance + bonus + bonusPersona));
    const vinto = Math.random() * 100 < probabilita;
    const risultato = vinto ? scelta.vittoria : scelta.sconfitta;
    deltas = applicaEffetti(risultato);
    testo = risultato.testo;
    esitoIncontro = vinto ? "vittoria" : "sconfitta";
  } else {
    deltas = applicaEffetti(scelta.effetti);
    testo = scelta.esito;
  }

  if (esitoIncontro === "vittoria") stato.vittorie++;
  if (esitoIncontro === "sconfitta") stato.sconfitte++;

  renderStato();

  if (stato.mento <= 0) return finePartita("ko");
  if (stato.hype <= 0) return finePartita("cut");

  mostraEsito(testo, deltas, esitoIncontro);
}

const ETICHETTE = { mento: "Mento & Cardio", hype: "Dana White Hype", aura: "Aura" };

function mostraEsito(testo, deltas, esitoIncontro) {
  const badge =
    esitoIncontro === "vittoria"
      ? '<div class="esito-badge vittoria">Vittoria</div>'
      : esitoIncontro === "sconfitta"
        ? '<div class="esito-badge sconfitta">Sconfitta</div>'
        : "";

  const chips = Object.entries(deltas)
    .map(
      ([chiave, delta]) =>
        `<span class="delta ${delta > 0 ? "su" : "giu"}">${delta > 0 ? "+" : ""}${delta} ${ETICHETTE[chiave]}</span>`
    )
    .join("");

  $("#card").innerHTML = `
    ${badge}
    <p class="scenario-testo esito">${testo}</p>
    <div class="delta-row">${chips || '<span class="delta neutro">Nessun effetto</span>'}</div>
    <button class="scelta avanti" id="avanti">Prossimo turno →</button>`;

  $("#avanti").addEventListener("click", () => {
    stato.incontro++;
    if (stato.incontro > MAX_TURNI) {
      return finePartita(stato.sconfitte === 0 ? "goat" : "fine-carriera");
    }
    renderStato();
    nuovoTurno();
  }, { once: true });
}

function testoCondivisione(causa) {
  const finale = FINALI[causa];
  const record = `${stato.vittorie}-${stato.sconfitte}`;
  return `🥊 Ho chiuso la carriera UFC di ${nomeAttivo} sul ${record} (a ${etaCorrente()} anni) su MMA Oggi ${finale.frase}! ${finale.emoji}\nProva a fare meglio: ${URL_GIOCO}`;
}

function finePartita(causa) {
  stato.finita = true;
  const finale = FINALI[causa];
  const classeEsito = causa === "goat" ? "goat" : ["ko", "cut", "usada"].includes(causa) ? "sconfitta" : "";

  $("#gioco").hidden = true;
  const box = $("#finale");
  box.hidden = false;
  box.className = `finale ${classeEsito}`.trim();
  box.innerHTML = `
    <div class="finale-emoji">${finale.emoji}</div>
    <div class="finale-sopra">${finale.sottotitolo}</div>
    <h2>${finale.titolo}</h2>
    <div class="finale-record">${stato.vittorie}-${stato.sconfitte}</div>
    <p>${finale.testo}</p>
    <div class="finale-stats">
      <span>${personaggioAttivo.emoji} ${escapeHtml(nomeAttivo)}${nomeAttivo !== personaggioAttivo.nome ? ` · ${personaggioAttivo.nome}` : ""}, ${etaCorrente()} anni</span>
      <span>Turni giocati: ${stato.incontro}</span>
      <span>Mento ${stato.mento}</span>
      <span>Hype ${stato.hype}</span>
      <span>Aura ${stato.aura}</span>
    </div>
    <div class="finale-azioni">
      <button class="scelta primaria" id="riprova">Riprova subito</button>
      <button class="scelta" id="copia">Copia risultato</button>
      <button class="scelta" id="cambia-stile">Cambia stile</button>
    </div>`;

  $("#riprova").addEventListener("click", () => nuovaPartita(personaggioAttivo));
  $("#cambia-stile").addEventListener("click", mostraSelezionePersonaggio);
  $("#copia").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(testoCondivisione(causa));
      btn.textContent = "Copiato! ✅";
    } catch {
      btn.textContent = "Copia non riuscita";
    }
    setTimeout(() => (btn.textContent = "Copia risultato"), 2200);
  });
}

renderChrome("gauntlet");
renderSelezionePersonaggi();
$("#ritirati").addEventListener("click", () => {
  if (stato && !stato.finita) finePartita("ritiro");
});
