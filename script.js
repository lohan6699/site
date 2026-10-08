// ========== ARMAZENAMENTO SEGURO ==========
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

const telaSplash = document.getElementById('telaSplash');
const telaEntrada = document.getElementById('telaEntrada');
const telaLogin = document.getElementById('telaLogin');
const sitePrincipal = document.getElementById('sitePrincipal');

function abrirLogin(aba) {
    if (telaEntrada) telaEntrada.classList.add('escondido');
    telaLogin.classList.remove('escondido');
    mostrarAba(aba || 'entrar');
}

function voltarEntrada() {
    telaLogin.classList.add('escondido');
    if (telaEntrada) telaEntrada.classList.remove('escondido');
}

function hashSenha(senha) {
    let hash = 5381;
    for (let i = 0; i < senha.length; i++) {
        hash = ((hash << 5) + hash) + senha.charCodeAt(i);
        hash = hash & hash;
    }
    return String(hash);
}

function carregarContas() {
    try {
        return JSON.parse(storage.getItem('portal_contas')) || {};
    } catch (e) {
        return {};
    }
}

function salvarContas(contas) {
    storage.setItem('portal_contas', JSON.stringify(contas));
}

function mostrarErro(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
}

function limparErros() {
    mostrarErro('erroLogin', '');
    mostrarErro('erroCriar', '');
}

function mostrarAba(aba) {
    limparErros();
    const btnEntrar = document.getElementById('abaEntrarBtn');
    const btnCriar = document.getElementById('abaCriarBtn');
    const formEntrar = document.getElementById('formEntrar');
    const formCriar = document.getElementById('formCriar');

    const ehEntrar = aba === 'entrar';
    formEntrar.classList.toggle('escondido', !ehEntrar);
    formCriar.classList.toggle('escondido', ehEntrar);
    btnEntrar.classList.toggle('ativa', ehEntrar);
    btnCriar.classList.toggle('ativa', !ehEntrar);
    btnEntrar.setAttribute('aria-selected', String(ehEntrar));
    btnCriar.setAttribute('aria-selected', String(!ehEntrar));

    const alvo = document.getElementById(ehEntrar ? 'loginUsuario' : 'criarUsuario');
    if (alvo) alvo.focus();
}

function alternarSenha(id, botao) {
    const input = document.getElementById(id);
    if (!input) return;
    const mostrando = input.type === 'text';
    input.type = mostrando ? 'password' : 'text';
    const usoIcone = botao.querySelector('use');
    if (usoIcone) usoIcone.setAttribute('href', mostrando ? '#icon-eye' : '#icon-eye-off');
    botao.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
}

function criarConta(evento) {
    if (evento) evento.preventDefault();
    limparErros();

    const usuario = sanitizarNome(document.getElementById('criarUsuario').value);
    const senha = document.getElementById('criarSenha').value;
    const senha2 = document.getElementById('criarSenha2').value;

    if (usuario.length < 2) {
        mostrarErro('erroCriar', 'Escolha um usuário com pelo menos 2 letras!');
        return false;
    }
    if (senha.length < 4) {
        mostrarErro('erroCriar', 'A senha precisa ter pelo menos 4 caracteres!');
        return false;
    }
    if (senha !== senha2) {
        mostrarErro('erroCriar', 'As senhas não são iguais!');
        return false;
    }

    const contas = carregarContas();
    const chave = usuario.toLowerCase();

    if (contas[chave]) {
        mostrarErro('erroCriar', 'Esse usuário já existe. Tente entrar ou escolha outro nome!');
        return false;
    }

    contas[chave] = {
        usuario: usuario,
        senhaHash: hashSenha(senha),
        criadoEm: Date.now()
    };

    try {
        salvarContas(contas);
        storage.setItem('nomeUsuario', usuario);
        entrarNoSite(usuario);
    } catch (e) {
        console.error('Erro ao criar conta:', e);
        mostrarErro('erroCriar', 'Ocorreu um erro ao criar a conta. Veja o console do navegador (F12) para detalhes.');
    }
    return false;
}

function fazerLogin(evento) {
    if (evento) evento.preventDefault();
    limparErros();

    const usuario = sanitizarNome(document.getElementById('loginUsuario').value);
    const senha = document.getElementById('loginSenha').value;

    if (usuario.length < 2) {
        mostrarErro('erroLogin', 'Digite seu usuário!');
        return false;
    }
    if (!senha) {
        mostrarErro('erroLogin', 'Digite sua senha!');
        return false;
    }

    const contas = carregarContas();
    const conta = contas[usuario.toLowerCase()];

    if (!conta) {
        mostrarErro('erroLogin', 'Usuário não encontrado. Que tal criar uma conta?');
        return false;
    }
    if (conta.senhaHash !== hashSenha(senha)) {
        mostrarErro('erroLogin', 'Senha incorreta!');
        return false;
    }

    try {
        storage.setItem('nomeUsuario', conta.usuario);
        entrarNoSite(conta.usuario);
    } catch (e) {
        console.error('Erro ao entrar no site:', e);
        mostrarErro('erroLogin', 'Ocorreu um erro ao entrar. Veja o console do navegador (F12) para detalhes.');
    }
    return false;
}

['loginUsuario', 'loginSenha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => mostrarErro('erroLogin', ''));
});
['criarUsuario', 'criarSenha', 'criarSenha2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => mostrarErro('erroCriar', ''));
});

function entrarNoSite(nome) {
    if (telaEntrada) telaEntrada.classList.add('escondido');
    telaLogin.classList.add('escondido');
    telaLogin.style.display = 'none';
    sitePrincipal.style.display = 'block';
    document.getElementById('nomeExibido').textContent = nome;
    document.getElementById('nomeHero').textContent = nome;
    document.getElementById('nomeExibido').title = nome;
    migrarDadosAntigos();
    carregarPontuacao();
    carregarJogosJogados();
    renderizarAvaliacoes();
    renderizarTags();
    atualizarEstatisticas();
    iniciarDestaqueBanner();
    renderizarTodosComentarios();
    aplicarFiltros();
}

function fazerLogout() {
    if (confirm('Sair da sua conta neste navegador? Seu progresso continua salvo aqui.')) {
        storage.removeItem('nomeUsuario');
        location.reload();
    }
}

function resetarProgresso() {
    if (confirm('Zerar pontos, jogos jogados e avaliações? Sua conta continua.')) {
        storage.removeItem(chaveUsuario('pontuacao'));
        storage.removeItem(chaveUsuario('jogosJogados'));
        storage.removeItem(chaveUsuario('avaliacoes'));
        location.reload();
    }
}

window.onload = function() {
    const prefereReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duracaoSplash = prefereReduzido ? 300 : 1600;

    try {
        const nomeSalvo = storage.getItem('nomeUsuario');
        if (nomeSalvo) {
            entrarNoSite(nomeSalvo);
        }
    } catch (e) {
        console.error('Erro ao carregar sessão salva:', e);
        mostrarErro('erroLogin', 'Não foi possível carregar seus dados salvos. Você ainda pode entrar ou criar uma conta normalmente.');
    }

    setTimeout(() => {
        if (telaSplash) {
            telaSplash.classList.add('escondido');
            setTimeout(() => { telaSplash.style.display = 'none'; }, 500);
        }
    }, duracaoSplash);
};

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
    card.classList.add('ja-jogado');
}

function atualizarProgresso() {
    const total = TOTAL_JOGOS;
    const jogados = jogosJogados.length;
    const label = document.getElementById('progressoLabel');
    const texto = jogados >= total && total > 0
        ? `Todos os ${total} jogos jogados`
        : `${jogados} de ${total} jogos jogados`;
    label.textContent = texto;
    document.getElementById('progressoFill').style.width = `${total ? (jogados / total) * 100 : 0}%`;
}

function atualizarEstatisticas() {
    const stat = document.getElementById('statJogos');
    if (stat) stat.textContent = String(TOTAL_JOGOS);
}

function mostrarMensagem(texto) {
    const msg = document.getElementById('mensagemPontos');
    msg.textContent = texto;
    msg.classList.add('mostrar');
    setTimeout(() => msg.classList.remove('mostrar'), 1600);
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
    const completou = jogosJogados.length === TOTAL_JOGOS;
    mostrarMensagem(completou ? 'Você jogou todos os jogos! +15 pontos' : '+15 pontos!');

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
    const contas = carregarContas();

    const locais = Object.values(contas).map(conta => ({
        nome: conta.usuario,
        pontos: parseInt(storage.getItem(`portal_${slugNome(conta.usuario)}_pontuacao`)) || 0,
        real: true
    }));

    const fakes = [
        { nome: 'SpaceMaster', pontos: 320, real: false },
        { nome: 'NinjaVeloz', pontos: 245, real: false },
        { nome: 'GamerPro', pontos: 180, real: false },
        { nome: 'NovaEstrela', pontos: 95, real: false },
        { nome: 'ProGamer22', pontos: 70, real: false }
    ];

    const nomesReais = new Set(locais.map(j => j.nome.toLowerCase()));
    const jogadores = locais.slice();
    fakes.forEach(fake => {
        if (!nomesReais.has(fake.nome.toLowerCase())) jogadores.push(fake);
    });

    if (!jogadores.some(j => j.nome.toLowerCase() === nomeAtual.toLowerCase())) {
        jogadores.push({ nome: nomeAtual, pontos: pontuacao, real: true });
    } else {
        jogadores.forEach(j => {
            if (j.nome.toLowerCase() === nomeAtual.toLowerCase()) j.pontos = pontuacao;
        });
    }

    jogadores.sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'));

    const lista = document.getElementById('listaRanking');
    lista.innerHTML = '';

    const classesMedalha = ['medalha-ouro', 'medalha-prata', 'medalha-bronze'];

    jogadores.forEach((jogador, index) => {
        const li = document.createElement('li');
        if (jogador.nome.toLowerCase() === nomeAtual.toLowerCase()) li.classList.add('voce');

        const spanPos = document.createElement('span');
        spanPos.className = 'ranking-pos';

        if (index < 3) {
            spanPos.classList.add(classesMedalha[index]);
            spanPos.innerHTML = '<svg class="icone icone-medalha" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-medal"></use></svg>';
            spanPos.setAttribute('aria-label', `${index + 1}º lugar`);
        } else {
            spanPos.textContent = `${index + 1}º`;
        }

        const spanNome = document.createElement('span');
        spanNome.className = 'ranking-nome';
        spanNome.textContent = jogador.nome;
        if (!jogador.real) {
            const tag = document.createElement('span');
            tag.className = 'ranking-visitante';
            tag.textContent = 'exemplo';
            spanNome.appendChild(tag);
        }

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
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            if (!nota) {
                mediaEl.innerHTML = '☆☆☆☆☆ <span class="nota-num">Novo</span> <span class="contagem">(0)</span>';
            } else {
                mediaEl.innerHTML = `${estrelasTexto(nota)} <span class="nota-num">${nota.toFixed(1)}</span> <span class="contagem">(${contagem})</span>`;
            }
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
        mostrarMensagem('+5 pontos por avaliar!');

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
    sincronizarPills(categoria);
    aplicarFiltros();
}

function selecionarCategoria(categoria) {
    filtroCategoriaAtual = categoria;
    const select = document.getElementById('filtroCategoria');
    if (select) select.value = categoria;
    sincronizarPills(categoria);
    aplicarFiltros();
}

function sincronizarPills(categoria) {
    document.querySelectorAll('#pillsCategoria .pill').forEach(pill => {
        const ativa = pill.dataset.cat === categoria;
        pill.classList.toggle('ativa', ativa);
        pill.setAttribute('aria-selected', String(ativa));
    });
}

function limparFiltros() {
    filtroTextoAtual = '';
    filtroCategoriaAtual = 'todas';
    const busca = document.getElementById('buscaJogo');
    const select = document.getElementById('filtroCategoria');
    const ordem = document.getElementById('ordenarPor');
    if (busca) busca.value = '';
    if (select) select.value = 'todas';
    if (ordem) {
        ordem.value = 'padrao';
        ordenarJogos('padrao');
    }
    sincronizarPills('todas');
    aplicarFiltros();
}

function aplicarFiltros() {
    const cards = document.querySelectorAll('#gamesGrid .game-card');
    let visiveis = 0;

    cards.forEach(card => {
        const titulo = card.querySelector('h3').textContent.toLowerCase();
        const descricao = card.querySelector('p').textContent.toLowerCase();
        const criadorEl = card.querySelector('.game-criador');
        const criador = criadorEl ? criadorEl.textContent.toLowerCase() : '';
        const tags = (card.dataset.tags || '').toLowerCase();
        const categoriaCard = (card.dataset.categoria || '').trim().toLowerCase();

        const correspondeTexto = !filtroTextoAtual
            || titulo.includes(filtroTextoAtual)
            || descricao.includes(filtroTextoAtual)
            || criador.includes(filtroTextoAtual)
            || tags.includes(filtroTextoAtual);

        const categoriaFiltro = (filtroCategoriaAtual || 'todas').trim().toLowerCase();
        const correspondeCategoria = categoriaFiltro === 'todas'
            || categoriaCard === categoriaFiltro;

        const corresponde = correspondeTexto && correspondeCategoria;
        card.classList.toggle('escondido', !corresponde);
        if (corresponde) visiveis += 1;
    });

    const semResultado = visiveis === 0;
    document.getElementById('semResultados').classList.toggle('mostrar', semResultado);
    const limpar = document.getElementById('limparFiltrosWrap');
    if (limpar) limpar.classList.toggle('escondido', !semResultado);

    const contagem = document.getElementById('resultadoContagem');
    if (contagem) {
        const filtrando = Boolean(filtroTextoAtual) || filtroCategoriaAtual !== 'todas';
        contagem.textContent = filtrando ? `${visiveis} de ${cards.length} jogos` : '';
    }
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

function renderizarTags() {
    document.querySelectorAll('.game-card').forEach(card => {
        const tags = (card.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        if (tags.some(t => t.toLowerCase() === 'novo')) card.classList.add('eh-novo');
        if (card.querySelector('.game-tags') || !tags.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'game-tags';
        tags.forEach(tag => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'tag ' + classeDaTag(tag);
            botao.textContent = tag;
            botao.addEventListener('click', () => {
                const busca = document.getElementById('buscaJogo');
                if (busca) busca.value = tag;
                filtrarJogos(tag);
                document.getElementById('jogos').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            wrap.appendChild(botao);
        });

        const ancora = card.querySelector('p');
        if (ancora) ancora.insertAdjacentElement('afterend', wrap);
    });
}

function classeDaTag(tag) {
    const t = tag.toLowerCase();
    if (t === 'novo' || t.includes('desenvolvimento')) return 'tag-novo';
    if (t.includes('estratégia') || t.includes('estrategia') || t.includes('tabuleiro')) return 'tag-roxo';
    if (t.includes('plataforma') || t.includes('pulo')) return 'tag-verde';
    if (t.includes('sobreviv')) return 'tag-lima';
    if (t.includes('tiro') || t.includes('espaço') || t.includes('espaco')) return 'tag-azul';
    if (t.includes('palavra')) return 'tag-ciano';
    if (t.includes('matemática') || t.includes('matematica') || t.includes('cálculo') || t.includes('calculo')) return 'tag-rosa';
    return 'tag-roxo';
}

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
    eyebrow.textContent = 'Em destaque';

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
    estrelasEl.innerHTML = nota
        ? `${estrelasTexto(nota)} <span class="nota-num">${nota.toFixed(1)}</span> <span class="contagem">(${contagem})</span>`
        : '☆☆☆☆☆ <span class="nota-num">Novo</span>';

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
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
}

function irParaSlide(index) {
    destaqueIndex = index;
    renderizarDestaqueSlide(destaqueIndex);
}

function iniciarDestaqueBanner() {
    if (cardsDestaque.length === 0) return;
    if (document.getElementById('destaqueDots').childElementCount) return;

    const dotsWrap = document.getElementById('destaqueDots');
    dotsWrap.innerHTML = '';
    cardsDestaque.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'dot';
        dot.type = 'button';
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

let elementoAntesDoModal = null;

function abrirModalSugerir() {
    elementoAntesDoModal = document.activeElement;
    const modal = document.getElementById('modalSugerir');
    modal.classList.remove('escondido');
    const foco = modal.querySelector('a, button');
    if (foco) foco.focus();
}

function fecharModalSugerir() {
    document.getElementById('modalSugerir').classList.add('escondido');
    if (elementoAntesDoModal && elementoAntesDoModal.focus) elementoAntesDoModal.focus();
}

function fecharModalSeClicarFora(evento) {
    if (evento.target.id === 'modalSugerir') fecharModalSugerir();
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') fecharModalSugerir();
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const alvo = e.target;
        const editando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
        if (!editando && sitePrincipal.style.display === 'block') {
            e.preventDefault();
            const busca = document.getElementById('buscaJogo');
            if (busca) {
                busca.focus();
                document.getElementById('jogos').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }
});

const CHAVE_COMENTARIOS = 'portal_comentarios';
const LIMITE_COMENTARIO = 300;

function carregarTodosComentarios() {
    try {
        return JSON.parse(storage.getItem(CHAVE_COMENTARIOS)) || {};
    } catch (e) {
        return {};
    }
}

function salvarTodosComentarios(dados) {
    storage.setItem(CHAVE_COMENTARIOS, JSON.stringify(dados));
}

function formatarDataComentario(timestamp) {
    try {
        const data = new Date(timestamp);
        return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
            ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function idComentarioUnico() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function contarComentarios(jogoId) {
    const todos = carregarTodosComentarios();
    return (todos[jogoId] || []).length;
}

function atualizarContagemComentarios(jogoId) {
    const contagem = contarComentarios(jogoId);
    document.querySelectorAll(`[data-jogo-comentarios="${jogoId}"] .comentarios-contagem`).forEach(el => {
        el.textContent = contagem > 0 ? `(${contagem})` : '';
    });
}

function renderizarComentarios(jogoId) {
    const box = document.querySelector(`[data-comentarios-box="${jogoId}"]`);
    if (!box) return;

    const todos = carregarTodosComentarios();
    const lista = todos[jogoId] || [];
    const nomeAtual = storage.getItem('nomeUsuario') || '';

    box.innerHTML = '';

    const ul = document.createElement('ul');
    ul.className = 'comentarios-lista';

    lista.slice().reverse().forEach(comentario => {
        const li = document.createElement('li');
        li.className = 'comentario-item';

        const cabecalho = document.createElement('div');
        cabecalho.className = 'comentario-cabecalho';

        const autor = document.createElement('span');
        autor.className = 'comentario-autor';
        autor.textContent = comentario.autor;
        autor.title = comentario.autor;

        const data = document.createElement('span');
        data.className = 'comentario-data';
        data.textContent = formatarDataComentario(comentario.data);

        cabecalho.append(autor, data);

        const texto = document.createElement('div');
        texto.className = 'comentario-texto';
        texto.textContent = comentario.texto;

        li.append(cabecalho, texto);

        if (comentario.autor.toLowerCase() === nomeAtual.toLowerCase()) {
            const excluir = document.createElement('button');
            excluir.type = 'button';
            excluir.className = 'comentario-excluir';
            excluir.innerHTML = '<svg class="icone icone-inline icone-pequeno" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-trash"></use></svg> Excluir';
            excluir.addEventListener('click', () => excluirComentario(jogoId, comentario.id));
            li.appendChild(excluir);
        }

        ul.appendChild(li);
    });

    const form = document.createElement('div');
    form.className = 'comentario-form';

    const textarea = document.createElement('textarea');
    textarea.className = 'comentario-textarea';
    textarea.placeholder = 'Escreva um comentário sobre este jogo...';
    textarea.maxLength = LIMITE_COMENTARIO;

    const enviar = document.createElement('button');
    enviar.type = 'button';
    enviar.className = 'comentario-enviar';
    enviar.textContent = 'Enviar';

    const erro = document.createElement('div');
    erro.className = 'comentario-erro';

    const contador = document.createElement('div');
    contador.className = 'comentario-contador';
    contador.textContent = `0/${LIMITE_COMENTARIO}`;
    textarea.addEventListener('input', () => {
        contador.textContent = `${textarea.value.length}/${LIMITE_COMENTARIO}`;
    });

    function tentarEnviar() {
        const texto = textarea.value.trim();
        erro.textContent = '';

        if (!nomeAtual) {
            erro.textContent = 'Você precisa estar logado para comentar.';
            return;
        }
        if (!texto) {
            erro.textContent = 'Escreva algo antes de enviar.';
            return;
        }
        if (texto.length > LIMITE_COMENTARIO) {
            erro.textContent = `Máximo de ${LIMITE_COMENTARIO} caracteres.`;
            return;
        }

        adicionarComentario(jogoId, nomeAtual, texto);
        textarea.value = '';
        contador.textContent = `0/${LIMITE_COMENTARIO}`;
    }

    enviar.addEventListener('click', tentarEnviar);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            tentarEnviar();
        }
    });

    form.append(textarea, enviar);
    box.append(ul, form, contador, erro);
}

function adicionarComentario(jogoId, autor, texto) {
    const todos = carregarTodosComentarios();
    if (!todos[jogoId]) todos[jogoId] = [];

    const primeiraVez = todos[jogoId].every(c => c.autor.toLowerCase() !== autor.toLowerCase());

    todos[jogoId].push({
        id: idComentarioUnico(),
        autor: autor,
        texto: texto.slice(0, LIMITE_COMENTARIO),
        data: Date.now()
    });

    salvarTodosComentarios(todos);
    renderizarComentarios(jogoId);
    atualizarContagemComentarios(jogoId);
    mostrarMensagem('Comentário enviado!');

    if (primeiraVez) {
        const pontosAntigos = pontuacao;
        pontuacao += 5;
        storage.setItem(chaveUsuario('pontuacao'), pontuacao);
        animarNumero(pontosAntigos, pontuacao);
        if (document.getElementById('rankingBox').classList.contains('mostrar')) {
            atualizarRanking();
        }
    }
}

function excluirComentario(jogoId, comentarioId) {
    if (!confirm('Excluir esse comentário?')) return;

    const todos = carregarTodosComentarios();
    if (!todos[jogoId]) return;

    todos[jogoId] = todos[jogoId].filter(c => c.id !== comentarioId);
    salvarTodosComentarios(todos);
    renderizarComentarios(jogoId);
    atualizarContagemComentarios(jogoId);
}

function alternarComentarios(jogoId) {
    const box = document.querySelector(`[data-comentarios-box="${jogoId}"]`);
    if (!box) return;

    const abrindo = box.classList.contains('escondido');
    box.classList.toggle('escondido');

    if (abrindo) {
        renderizarComentarios(jogoId);
        const textarea = box.querySelector('.comentario-textarea');
        if (textarea) textarea.focus();
    }
}

function renderizarTodosComentarios() {
    document.querySelectorAll('[data-jogo-comentarios]').forEach(btn => {
        const jogoId = btn.dataset.jogoComentarios;
        atualizarContagemComentarios(jogoId);
    });
}

document.querySelectorAll('[data-jogo-comentarios]').forEach(btn => {
    btn.addEventListener('click', () => alternarComentarios(btn.dataset.jogoComentarios));
});

document.querySelectorAll('#pillsCategoria .pill').forEach(pill => {
    pill.addEventListener('click', () => selecionarCategoria(pill.dataset.cat));
});

const btnTopo = document.getElementById('btnTopo');
if (btnTopo) {
    window.addEventListener('scroll', () => {
        btnTopo.hidden = window.scrollY < 500;
    }, { passive: true });
    btnTopo.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

renderizarTags();
atualizarEstatisticas();