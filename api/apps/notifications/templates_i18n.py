"""Server-rendered notification copy (EN / PT-PT). The mobile app also receives template + params."""

T = {
    "session_reminder": (
        "{left} left on your parking",
        "Faltam {left} no seu estacionamento",
        "{place} · planned departure {time}. Check the signs before staying longer.",
        "{place} · saída prevista {time}. Confirme a sinalização antes de ficar mais tempo.",
    ),
    "restriction_deadline": (
        "Restriction begins at {time}",
        "Restrição começa às {time}",
        "Move your car from {place} before {time} ({reason}).",
        "Retire o carro de {place} antes das {time} ({reason}).",
    ),
    "rule_change": ("Rule change at {place}", "Alteração de regra em {place}", "{detail}", "{detail}"),
    "report_status": ("Report {ref}: {status}", "Relato {ref}: {status}", "{detail}", "{detail}"),
    "welcome": (
        "Welcome to Zpot",
        "Bem-vindo ao Zpot",
        "Parking rules in this build are development sample data, not verified live information.",
        "As regras nesta versão são dados de exemplo de desenvolvimento, não informação real verificada.",
    ),
    "privacy_export_ready": (
        "Your data export is ready",
        "A sua exportação de dados está pronta",
        "Download it from Privacy › Requests within {days} days.",
        "Transfira-a em Privacidade › Pedidos no prazo de {days} dias.",
    ),
    "support_update": ("Support case {ref}: {status}", "Caso de suporte {ref}: {status}", "{detail}", "{detail}"),
    "saved_rule_change": ("A saved place changed: {place}", "Um local guardado mudou: {place}", "{detail}", "{detail}"),
}


def render(template, params, language="en"):
    t_en, t_pt, b_en, b_pt = T[template]
    pt = language == "pt-PT"
    safe = dict(params)
    return (t_pt if pt else t_en).format(**safe), (b_pt if pt else b_en).format(**safe)
