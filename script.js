// ========== UTILITÁRIOS ==========
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function sanitizarNome(nome) {
    // Remove tags e caracteres de controle, mantém só texto simples
    return nome.replace(/[<>]/g, '').trim().slice(0, 15);
}

// Converte o nome num identificador seguro para usar em chaves do localStorage,
// assim cada jogador tem sua própria pontuação/jogos/avaliações salvos.
function slugNome(nome) {
    return nome
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'jogador';
}

function chaveUsuario(sufixo) {
    const nome = localStorage.getItem('nomeUsuario') || '';
    return `portal_${slugNome(nome)}_${sufixo}`;
}

// Migra dados salvos no formato antigo (global, sem separação por usuário)
// para o novo formato por usuário, na primeira vez que essa pessoa entrar
// depois da atualização. Evita que quem já jogou perca os pontos.
function migrarDadosAntigos() {
    const jaTemDadosNovos = localStorage.getItem(chaveUsuario('pontuacao')) !== null;
    if (jaTemDadosNovos) return;

    const pontosAntigos = localStorage.getItem('pontuacaoPortal');
    const jogosAntigos = localStorage.getItem('jogosJogados');
    const avaliacoesAntigas = localStorage.getItem('minhasAvaliacoes');

    if (pontosAntigos !== null) localStorage.setItem(chaveUsuario('pontuacao'), pontosAntigos);
    if (jogosAntigos !== null) localStorage.setItem(chaveUsuario('jogosJogados'), jogosAntigos);
    if (avaliacoesAntigas !== null) localStorage.setItem(chaveUsuario('avaliacoes'), avaliacoesAntigas);

    // Limpa as chaves antigas para não vazar dados entre nomes diferentes no futuro
    localStorage.removeItem('pontuacaoPortal');
    localStorage.removeItem('jogosJogados');
    localStorage.removeItem('minhasAvaliacoes');
}

const TOTAL_JOGOS = document.querySelectorAll('[data-jogo-btn]').length;

// ========== LOGIN ==========
const telaLogin = document.getElementById('telaLogin');
const sitePrincipal = document.getElementById('sitePrincipal');
const inputNome = document.getElementById('inputNome');
const erroLogin = document.getElementById('erroLogin');

window.onload = function() {
    const nomeSalvo = localStorage.getItem('nomeUsuario');
    if (nomeSalvo) {
        entrarNoSite(nomeSalvo);
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
    localStorage.setItem('nomeUsuario', nome);
    entrarNoSite(nome);
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
    if (confirm('Tem certeza que deseja sair? Você pode entrar de novo com o mesmo nome para recuperar sua pontuação.')) {
        localStorage.removeItem('nomeUsuario');
        location.reload();
    }
}

function resetarProgresso() {
    if (confirm('Isso vai zerar seus pontos, jogos jogados e avaliações. Continuar?')) {
        localStorage.removeItem(chaveUsuario('pontuacao'));
        localStorage.removeItem(chaveUsuario('jogosJogados'));
        localStorage.removeItem(chaveUsuario('avaliacoes'));
        location.reload();
    }
}

// ========== PONTUAÇÃO ==========
let pontuacao = 0;
let jogosJogados = [];

function carregarPontuacao() {
    pontuacao = parseInt(localStorage.getItem(chaveUsuario('pontuacao'))) || 0;
    document.getElementById('pontuacao').textContent = pontuacao;
}

function carregarJogosJogados() {
    try {
        jogosJogados = JSON.parse(localStorage.getItem(chaveUsuario('jogosJogados'))) || [];
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

function adicionarPontos(id, card) {
    // Só concede pontos na primeira vez que o jogo é aberto
    if (jogosJogados.includes(id)) return;

    jogosJogados.push(id);
    localStorage.setItem(chaveUsuario('jogosJogados'), JSON.stringify(jogosJogados));
    marcarComoJogado(card);
    atualizarProgresso();

    const pontosAntigos = pontuacao;
    pontuacao += 15;
    localStorage.setItem(chaveUsuario('pontuacao'), pontuacao);

    animarNumero(pontosAntigos, pontuacao);

    const msg = document.getElementById('mensagemPontos');
    msg.textContent = '+15 pontos! 🎉';
    msg.classList.add('mostrar');
    setTimeout(() => msg.classList.remove('mostrar'), 1400);

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

// ========== RANKING ==========
function atualizarRanking() {
    const nomeAtual = localStorage.getItem('nomeUsuario') || 'Você';

    // Jogadores fictícios, para dar contexto de ranking
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
        spanNome.textContent = jogador.nome; // textContent evita XSS

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

// ========== AVALIAÇÕES ==========
function carregarMinhasAvaliacoes() {
    try {
        return JSON.parse(localStorage.getItem(chaveUsuario('avaliacoes'))) || {};
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

        // Nota média (editorial, exibida como referência de popularidade)
        const mediaEl = card.querySelector('.estrelas-media');
        if (mediaEl) {
            mediaEl.innerHTML = `${estrelasTexto(nota)} <span class="nota-num">${nota.toFixed(1)}</span> <span class="contagem">(${contagem})</span>`;
        }

        // Sua nota (interativa, salva localmente)
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
    localStorage.setItem(chaveUsuario('avaliacoes'), JSON.stringify(minhas));

    renderizarAvaliacoes();

    if (primeiraVez) {
        const pontosAntigos = pontuacao;
        pontuacao += 5;
        localStorage.setItem(chaveUsuario('pontuacao'), pontuacao);
        animarNumero(pontosAntigos, pontuacao);

        const msg = document.getElementById('mensagemPontos');
        msg.textContent = '+5 pontos por avaliar! ⭐';
        msg.classList.add('mostrar');
        setTimeout(() => msg.classList.remove('mostrar'), 1400);

        if (document.getElementById('rankingBox').classList.contains('mostrar')) {
            atualizarRanking();
        }
    }
}

// ========== BUSCA ==========
function filtrarJogos(termo) {
    const busca = termo.trim().toLowerCase();
    const cards = document.querySelectorAll('#gamesGrid .game-card');
    let algumVisivel = false;

    cards.forEach(card => {
        const titulo = card.querySelector('h3').textContent.toLowerCase();
        const descricao = card.querySelector('p').textContent.toLowerCase();
        const corresponde = titulo.includes(busca) || descricao.includes(busca);
        card.classList.toggle('escondido', !corresponde);
        if (corresponde) algumVisivel = true;
    });

    document.getElementById('semResultados').classList.toggle('mostrar', !algumVisivel);
}

// ========== ORDENAÇÃO ==========
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

// Guarda a ordem original dos cards para a opção "Padrão"
document.querySelectorAll('#gamesGrid .game-card').forEach((card, index) => {
    card.dataset.ordemOriginal = index;
});

// ========== BANNER DE DESTAQUE ROTATIVO ==========
let destaqueIndex = 0;
let destaqueIntervalo = null;
const cardsDestaque = Array.from(document.querySelectorAll('.game-card.destaque'));

function renderizarDestaqueSlide(index) {
    const card = cardsDestaque[index];
    if (!card) return;

    const icone = card.querySelector('.game-icon').textContent;
    const titulo = card.querySelector('h3').textContent;
    const desc = card.querySelector('p').textContent;
    const link = card.querySelector('.btn-jogar').getAttribute('href');
    const jogoId = card.dataset.jogo;
    const nota = parseFloat(card.dataset.nota);
    const contagem = card.dataset.contagem;

    const slide = document.getElementById('destaqueSlide');
    slide.innerHTML = '';

    const iconeEl = document.createElement('span');
    iconeEl.className = 'game-icon';
    iconeEl.textContent = icone;

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
    slide.append(iconeEl, info);

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