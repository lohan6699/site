// ========== ARMAZENAMENTO SEGURO ==========
// Em alguns contextos (arquivo aberto direto como file://, modo anônimo,
// certas configurações de navegador) o localStorage pode lançar um erro
// e travar o site sem nenhum aviso. Esse wrapper tenta usar o localStorage
// normalmente, mas se falhar, usa memória temporária, então o site sempre
// funciona (só não salva entre sessões nesse caso de fallback).
const memoriaTemporaria = {};
let avisoStorageMostrado = false;

function avisarStorageIndisponivel() {
    if (avisoStorageMostrado) return;
    avisoStorageMostrado = true;
    console.warn('Aviso: localStorage indisponível neste contexto. Usando armazenamento temporário (não será salvo ao recarregar a página).');
}

const storage = {
    getItem(chave) {
        try {
            return window.localStorage.getItem(chave);
        } catch (e) {
            avisarStorageIndisponivel();
            return Object.prototype.hasOwnProperty.call(memoriaTemporaria, chave) ? memoriaTemporaria[chave] : null;
        }
    },
    setItem(chave, valor) {
        try {
            window.localStorage.setItem(chave, valor);
        } catch (e) {
            avisarStorageIndisponivel();
            memoriaTemporaria[chave] = String(valor);
        }
    },
    removeItem(chave) {
        try {
            window.localStorage.removeItem(chave);
        } catch (e) {
            avisarStorageIndisponivel();
            delete memoriaTemporaria[chave];
        }
    }
};

// ========== UTILITÁRIOS ==========
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function sanitizarNome(nome) {
    return nome.replace(/[<>]/g, '').trim().slice(0, 15);
}

function slugNome(nome) {
    return nome
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'jogador';
}

function chaveUsuario(sufixo) {
    const nome = storage.getItem('nomeUsuario') || '';
    return `portal_${slugNome(nome)}_${sufixo}`;
}

function migrarDadosAntigos() {
    const jaTemDadosNovos = storage.getItem(chaveUsuario('pontuacao')) !== null;
    if (jaTemDadosNovos) return;

    const pontosAntigos = storage.getItem('pontuacaoPortal');
    const jogosAntigos = storage.getItem('jogosJogados');
    const avaliacoesAntigas = storage.getItem('minhasAvaliacoes');

    if (pontosAntigos !== null) storage.setItem(chaveUsuario('pontuacao'), pontosAntigos);
    if (jogosAntigos !== null) storage.setItem(chaveUsuario('jogosJogados'), jogosAntigos);
    if (avaliacoesAntigas !== null) storage.setItem(chaveUsuario('avaliacoes'), avaliacoesAntigas);

    storage.removeItem('pontuacaoPortal');
    storage.removeItem('jogosJogados');
    storage.removeItem('minhasAvaliacoes');
}

const TOTAL_JOGOS = document.querySelectorAll('[data-jogo-btn]').length;

const telaLogin = document.getElementById('telaLogin');
const sitePrincipal = document.getElementById('sitePrincipal');
const inputNome = document.getElementById('inputNome');
const erroLogin = document.getElementById('erroLogin');

window.onload = function() {
    try {
        const nomeSalvo = storage.getItem('nomeUsuario');
        if (nomeSalvo) {
            entrarNoSite(nomeSalvo);
        }
    } catch (e) {
        console.error('Erro ao carregar sessão salva:', e);
        erroLogin.textContent = 'Não foi possível carregar seus dados salvos. Você ainda pode digitar seu nome e jogar normalmente.';
    }
};

inputNome.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') fazerLogin();
});

inputNome.addEventListener('input', function() {
    erroLogin.textContent = '';
});

function fazerLogin() {
    const nome = sanitizarNome(inputNome.value);
    if (nome.length < 2) {
        erroLogin.textContent = 'Digite um nome com pelo menos 2 letras!';
        inputNome.focus();
        return;
    }
    try {
        storage.setItem('nomeUsuario', nome);
        entrarNoSite(nome);
    } catch (e) {
        console.error('Erro ao entrar no site:', e);
        erroLogin.textContent = 'Ocorreu um erro ao entrar. Veja o console do navegador (F12) para detalhes.';
    }
}

function entrarNoSite(nome) {
    telaLogin.style.display = 'none';
    sitePrincipal.style.display = 'block';
    document.getElementById('nomeExibido').textContent = nome;
    document.getElementById('nomeHero').textContent = nome;
    document.getElementById('nomeExibido').title = nome;
    migrarDadosAntigos();
    carregarPontuacao();
    carregarJogosJogados();
    renderizarAvaliacoes();
    iniciarDestaqueBanner();
}

function fazerLogout() {
    if (confirm('sair?')) {
        storage.removeItem('nomeUsuario');
        location.reload();
    }
}

function resetarProgresso() {
    if (confirm('resetar?')) {
        storage.removeItem(chaveUsuario('pontuacao'));
        storage.removeItem(chaveUsuario('jogosJogados'));
        storage.removeItem(chaveUsuario('avaliacoes'));
        location.reload();
    }
}

let pontuacao = 0;
let jogosJogados = [];

function carregarPontuacao() {
    pontuacao = parseInt(storage.getItem(chaveUsuario('pontuacao'))) || 0;
    document.getElementById('pontuacao').textContent = pontuacao;
}

function carregarJogosJogados() {
    try {
        jogosJogados = JSON.parse(storage.getItem(chaveUsuario('jogosJogados'))) || [];
    } catch (e) {
        jogosJogados = [];
    }
    document.querySelectorAll('.game-card').forEach(card => {
        const id = card.dataset.jogo;
        if (jogosJogados.includes(id)) {
            marcarComoJogado(card);
        }
    });
    atualizarProgresso();
}

function marcarComoJogado(card) {
    const selo = card.querySelector('.selo-jogado');
    if (selo) selo.hidden = false;
}

function atualizarProgresso() {
    const total = TOTAL_JOGOS;
    const jogados = jogosJogados.length;
    document.getElementById('progressoLabel').textContent = `${jogados} de ${total} jogos jogados`;
    document.getElementById('progressoFill').style.width = `${(jogados / total) * 100}%`;
}

function mostrarMensagem(texto) {
    const msg = document.getElementById('mensagemPontos');
    msg.textContent = texto;
    msg.classList.add('mostrar');
    setTimeout(() => msg.classList.remove('mostrar'), 1400);
}

function adicionarPontos(id, card) {
    if (jogosJogados.includes(id)) return;

    jogosJogados.push(id);
    storage.setItem(chaveUsuario('jogosJogados'), JSON.stringify(jogosJogados));
    marcarComoJogado(card);
    atualizarProgresso();

    const pontosAntigos = pontuacao;
    pontuacao += 15;
    storage.setItem(chaveUsuario('pontuacao'), pontuacao);

    animarNumero(pontosAntigos, pontuacao);
    mostrarMensagem('+15 pontos! 🎉');

    if (document.getElementById('rankingBox').classList.contains('mostrar')) {
        atualizarRanking();
    }
}

document.querySelectorAll('[data-jogo-btn]').forEach(link => {
    link.addEventListener('click', function() {
        const id = this.dataset.jogoBtn;
        const card = this.closest('.game-card');
        adicionarPontos(id, card);
    });
});

function animarNumero(inicio, fim) {
    const elemento = document.getElementById('pontuacao');
    const duracao = 600;
    const inicioTempo = performance.now();

    function atualizar(agora) {
        const progresso = Math.min((agora - inicioTempo) / duracao, 1);
        const valor = Math.floor(inicio + (fim - inicio) * progresso);
        elemento.textContent = valor;
        if (progresso < 1) requestAnimationFrame(atualizar);
    }
    requestAnimationFrame(atualizar);
}

function atualizarRanking() {
    const nomeAtual = storage.getItem('nomeUsuario') || 'Você';

    const fakes = [
        { nome: "SpaceMaster", pontos: 320 },
        { nome: "NinjaVeloz", pontos: 245 },
        { nome: "GamerPro", pontos: 180 },
        { nome: "NovaEstrela", pontos: 95 },
        { nome: "ProGamer22", pontos: 70 }
    ];

    const jogadores = fakes.filter(j => j.nome.toLowerCase() !== nomeAtual.toLowerCase());
    jogadores.push({ nome: nomeAtual, pontos: pontuacao });

    jogadores.sort((a, b) => b.pontos - a.pontos);

    const lista = document.getElementById('listaRanking');
    lista.innerHTML = '';

    const medalhas = ['🥇', '🥈', '🥉'];

    jogadores.forEach((jogador, index) => {
        const li = document.createElement('li');
        if (jogador.nome === nomeAtual) li.classList.add('voce');

        const posicao = index < 3 ? medalhas[index] : `${index + 1}º`;

        const spanPos = document.createElement('span');
        spanPos.className = 'ranking-pos';
        spanPos.textContent = posicao;

        const spanNome = document.createElement('span');
        spanNome.className = 'ranking-nome';
        spanNome.textContent = jogador.nome;

        const spanPontos = document.createElement('span');
        spanPontos.textContent = `${jogador.pontos} pts`;

        li.append(spanPos, spanNome, spanPontos);
        lista.appendChild(li);
    });
}

function mostrarRanking() {
    const box = document.getElementById('rankingBox');
    box.classList.toggle('mostrar');
    if (box.classList.contains('mostrar')) {
        atualizarRanking();
    }
}

function carregarMinhasAvaliacoes() {
    try {
        return JSON.parse(storage.getItem(chaveUsuario('avaliacoes'))) || {};
    } catch (e) {
        return {};
    }
}

function estrelasTexto(nota) {
    const cheias = Math.round(nota);
    return '★'.repeat(cheias) + '☆'.repeat(5 - cheias);
}

function renderizarAvaliacoes() {
    const minhas = carregarMinhasAvaliacoes();

    document.querySelectorAll('.game-card').forEach(card => {
        const nota = parseFloat(card.dataset.nota);
        const contagem = card.dataset.contagem;

        const mediaEl = card.querySelector('.estrelas-media');
        if (mediaEl) {
            mediaEl.innerHTML = `${estrelasTexto(nota)} <span class="nota-num">${nota.toFixed(1)}</span> <span class="contagem">(${contagem})</span>`;
        }

        const jogoId = card.dataset.jogo;
        const container = card.querySelector('[data-jogo-avaliar]');
        if (container) {
            container.innerHTML = '';
            for (let i = 1; i <= 5; i++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'estrela';
                btn.dataset.valor = i;
                btn.setAttribute('aria-label', `Avaliar com ${i} estrela${i > 1 ? 's' : ''}`);
                btn.textContent = '★';
                if (minhas[jogoId] && i <= minhas[jogoId]) {
                    btn.classList.add('preenchida');
                }
                btn.addEventListener('click', () => avaliarJogo(jogoId, i, card));
                container.appendChild(btn);
            }
        }
    });
}

function avaliarJogo(jogoId, valor, card) {
    const minhas = carregarMinhasAvaliacoes();
    const primeiraVez = !minhas[jogoId];
    minhas[jogoId] = valor;
    storage.setItem(chaveUsuario('avaliacoes'), JSON.stringify(minhas));

    renderizarAvaliacoes();

    if (primeiraVez) {
        const pontosAntigos = pontuacao;
        pontuacao += 5;
        storage.setItem(chaveUsuario('pontuacao'), pontuacao);
        animarNumero(pontosAntigos, pontuacao);
        mostrarMensagem('+5 pontos por avaliar! ⭐');

        if (document.getElementById('rankingBox').classList.contains('mostrar')) {
            atualizarRanking();
        }
    }
}

let filtroTextoAtual = '';
let filtroCategoriaAtual = 'todas';

function filtrarJogos(termo) {
    filtroTextoAtual = termo.trim().toLowerCase();
    aplicarFiltros();
}

function filtrarPorCategoria(categoria) {
    filtroCategoriaAtual = categoria;
    aplicarFiltros();
}

function aplicarFiltros() {
    const cards = document.querySelectorAll('#gamesGrid .game-card');
    let algumVisivel = false;

    cards.forEach(card => {
        const titulo = card.querySelector('h3').textContent.toLowerCase();
        const descricao = card.querySelector('p').textContent.toLowerCase();
        const criadorEl = card.querySelector('.game-criador');
        const criador = criadorEl ? criadorEl.textContent.toLowerCase() : '';

        const correspondeTexto = !filtroTextoAtual
            || titulo.includes(filtroTextoAtual)
            || descricao.includes(filtroTextoAtual)
            || criador.includes(filtroTextoAtual);

        const correspondeCategoria = filtroCategoriaAtual === 'todas'
            || card.dataset.categoria === filtroCategoriaAtual;

        const corresponde = correspondeTexto && correspondeCategoria;
        card.classList.toggle('escondido', !corresponde);
        if (corresponde) algumVisivel = true;
    });

    document.getElementById('semResultados').classList.toggle('mostrar', !algumVisivel);
}

function ordenarJogos(criterio) {
    const grid = document.getElementById('gamesGrid');
    const cards = Array.from(grid.querySelectorAll('.game-card'));

    if (criterio === 'nota') {
        cards.sort((a, b) => parseFloat(b.dataset.nota) - parseFloat(a.dataset.nota));
    } else if (criterio === 'contagem') {
        cards.sort((a, b) => parseInt(b.dataset.contagem) - parseInt(a.dataset.contagem));
    } else {
        cards.sort((a, b) => parseInt(a.dataset.ordemOriginal) - parseInt(b.dataset.ordemOriginal));
    }

    cards.forEach(card => grid.appendChild(card));
}

document.querySelectorAll('#gamesGrid .game-card').forEach((card, index) => {
    card.dataset.ordemOriginal = index;
});

let destaqueIndex = 0;
let destaqueIntervalo = null;
const cardsDestaque = Array.from(document.querySelectorAll('.game-card.destaque'));

function renderizarDestaqueSlide(index) {
    const card = cardsDestaque[index];
    if (!card) return;

    const titulo = card.querySelector('h3').textContent;
    const desc = card.querySelector('p').textContent;
    const link = card.querySelector('.btn-jogar').getAttribute('href');
    const jogoId = card.dataset.jogo;
    const nota = parseFloat(card.dataset.nota);
    const contagem = card.dataset.contagem;
    const personagemOriginal = card.querySelector('.personagem-card');

    const slide = document.getElementById('destaqueSlide');
    slide.innerHTML = '';

    const info = document.createElement('div');
    info.className = 'destaque-info';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'destaque-eyebrow';
    eyebrow.textContent = '★ Em destaque';

    const tituloEl = document.createElement('div');
    tituloEl.className = 'destaque-titulo';
    tituloEl.textContent = titulo;

    const descEl = document.createElement('div');
    descEl.className = 'destaque-desc';
    descEl.textContent = desc;

    const rodape = document.createElement('div');
    rodape.className = 'destaque-rodape';

    const estrelasEl = document.createElement('div');
    estrelasEl.className = 'estrelas-media';
    estrelasEl.innerHTML = `${estrelasTexto(nota)} <span class="nota-num">${nota.toFixed(1)}</span> <span class="contagem">(${contagem})</span>`;

    const botao = document.createElement('a');
    botao.href = link;
    botao.target = '_blank';
    botao.rel = 'noopener noreferrer';
    botao.className = 'btn-jogar';
    botao.textContent = 'Jogar Agora';
    botao.addEventListener('click', () => adicionarPontos(jogoId, card));

    rodape.append(estrelasEl, botao);
    info.append(eyebrow, tituloEl, descEl, rodape);

    if (personagemOriginal) {
        const personagemClone = personagemOriginal.cloneNode(true);
        slide.append(personagemClone, info);
    } else {
        slide.append(info);
    }

    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.toggle('ativo', i === index);
    });
}

function irParaSlide(index) {
    destaqueIndex = index;
    renderizarDestaqueSlide(destaqueIndex);
}

function iniciarDestaqueBanner() {
    if (cardsDestaque.length === 0) return;

    const dotsWrap = document.getElementById('destaqueDots');
    dotsWrap.innerHTML = '';
    cardsDestaque.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.setAttribute('aria-label', `Ver destaque ${i + 1}`);
        dot.addEventListener('click', () => {
            irParaSlide(i);
            reiniciarAutoRotate();
        });
        dotsWrap.appendChild(dot);
    });

    renderizarDestaqueSlide(destaqueIndex);
    reiniciarAutoRotate();
}

function reiniciarAutoRotate() {
    if (destaqueIntervalo) clearInterval(destaqueIntervalo);
    const prefereReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefereReduzido || cardsDestaque.length <= 1) return;

    destaqueIntervalo = setInterval(() => {
        destaqueIndex = (destaqueIndex + 1) % cardsDestaque.length;
        renderizarDestaqueSlide(destaqueIndex);
    }, 6000);
}

// ========== COMPARTILHAR LINK DO JOGO ==========
document.querySelectorAll('.btn-compartilhar').forEach(btn => {
    btn.addEventListener('click', async function() {
        const card = this.closest('.game-card');
        const link = card.querySelector('.btn-jogar').href;

        try {
            await navigator.clipboard.writeText(link);
            mostrarMensagem('Link copiado! 🔗');
        } catch (e) {
            // Navegadores sem permissão de clipboard (ou contexto file://):
            // mostra o link pra copiar manualmente em vez de travar.
            window.prompt('Copie o link do jogo:', link);
        }
    });
});

// ========== MODAL: SUGERIR UM JOGO ==========
function abrirModalSugerir() {
    document.getElementById('modalSugerir').classList.remove('escondido');
}

function fecharModalSugerir() {
    document.getElementById('modalSugerir').classList.add('escondido');
}

function fecharModalSeClicarFora(evento) {
    if (evento.target.id === 'modalSugerir') fecharModalSugerir();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fecharModalSugerir();
});