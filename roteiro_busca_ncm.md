# Roteiro de Busca para Classificação Fiscal NCM

Este roteiro descreve um método estruturado para realizar a classificação fiscal de mercadorias na Nomenclatura Comum do Mercosul (NCM), utilizando ferramentas de pesquisa e análise de informações legais e regulatórias.

## Objetivo

Fornecer um guia passo a passo para LLMs (Large Language Models) realizarem análises de classificação fiscal de forma completa, precisa e fundamentada, garantindo a conformidade com a legislação vigente.

## Metodologia

A metodologia segue um processo iterativo de pesquisa, análise e síntese, garantindo que todos os aspectos relevantes para a classificação sejam considerados.

### Fases do Roteiro de Busca

1.  **Identificação e Contextualização da Mercadoria/Situação**

    - **Descrição:** Definir claramente a mercadoria a ser classificada, suas características físicas, composição, uso, apresentação (embalagem, forma) e qualquer outra informação relevante.
    - **Objetivo da Classificação:** Esclarecer o propósito da classificação (ex: importação, exportação, operação interna, análise tributária).
    - **Pesquisa Inicial (se necessário):** Realizar pesquisas preliminares para entender o produto caso a descrição inicial não seja totalmente clara.

2.  **Pesquisa da Descrição Oficial e Estrutura da NCM**

    - **Ferramenta:** Utilizar uma ferramenta de pesquisa (ex: `perplexity-search`) com uma query focada na descrição oficial da NCM e sua posição na estrutura.
    - **Query Exemplo:** `NCM [código ou descrição do produto] descrição oficial TIPI estrutura`
    - **Análise do Resultado:** Identificar o código NCM provável, a descrição oficial conforme a TIPI, e sua localização na estrutura da NCM (Seção, Capítulo, Posição, Subposição).

3.  **Análise Legal e Estrutural (Notas Legais, NESH, RGIs)**

    - **Ferramenta:** Utilizar ferramenta de pesquisa.
    - **Query Exemplo:** `NCM [código identificado] Notas Legais de Seção e Capítulo NESH Regras Gerais de Interpretação`
    - **Análise do Resultado:**
        - Estudar as Notas Legais da Seção e do Capítulo onde a NCM está inserida para identificar exclusões, inclusões ou definições específicas.
        - Consultar as Notas Explicativas do Sistema Harmonizado (NESH) para a Posição e Subposição relevantes, buscando detalhes sobre o escopo da classificação.
        - Revisar as Regras Gerais de Interpretação (RGIs) do Sistema Harmonizado e determinar quais são aplicáveis ao caso (geralmente RGI 1 e RGI 6 são fundamentais, mas outras podem ser relevantes dependendo do produto).

4.  **Pesquisa Tributária**

    - **Ferramenta:** Utilizar ferramenta de pesquisa.
    - **Query Exemplo:** `NCM [código identificado] alíquotas impostos II IPI PIS COFINS ICMS Substituição Tributária`
    - **Análise do Resultado:** Identificar as alíquotas dos principais impostos (II, IPI, PIS, COFINS) e verificar se o produto está sujeito ao regime de Substituição Tributária de ICMS em algum estado, buscando o CEST (Código Especificador da Substituição Tributária) se aplicável.

5.  **Pesquisa Regulatória e Administrativa**

    - **Ferramenta:** Utilizar ferramenta de pesquisa.
    - **Query Exemplo:** `NCM [código identificado] tratamento administrativo ANVISA MAPA regulamentação importação`
    - **Análise do Resultado:** Verificar se o produto está sujeito à anuência prévia de órgãos como ANVISA, MAPA ou outros. Identificar requisitos específicos para importação ou exportação (ex: licenciamento não automático, certificados).

6.  **Busca por Precedentes (Soluções de Consulta)**

    - **Ferramenta:** Utilizar ferramenta de pesquisa.
    - **Query Exemplo:** `NCM [código identificado] Soluções de Consulta Receita Federal COSIT [tipo de produto ou termo relevante]`
    - **Análise do Resultado:** Buscar Soluções de Consulta da Receita Federal ou outros pareceres que tratem da classificação de produtos similares ou da mesma NCM. Analisar o raciocínio da autoridade fiscal em casos concretos.

7.  **Análise de NCMs Alternativas**

    - **Ferramenta:** Utilizar ferramenta de pesquisa.
    - **Query Exemplo:** `NCMs alternativas para [descrição do produto] NCM [código identificado]`
    - **Análise do Resultado:** Identificar outros códigos NCM que poderiam, à primeira vista, ser considerados para o produto. Para cada alternativa, justificar tecnicamente por que ela foi descartada em favor da NCM principal sugerida, utilizando as RGIs, Notas Legais e NESH.

8.  **Compilação e Justificativa Final**
    - **Síntese:** Reunir todas as informações coletadas nas fases anteriores.
    - **Justificativa Técnica:** Elaborar uma justificativa detalhada para a NCM principal sugerida, explicando o enquadramento na estrutura da NCM e a aplicação das Notas Legais, NESH e RGIs. Citar as fontes consultadas.
    - **Implicações e Desafios:** Descrever o tratamento administrativo, os tributos incidentes e quaisquer desafios ou observações relevantes para a classificação e operações futuras.
    - **Formato de Saída:** Apresentar a análise final de forma estruturada, similar ao exemplo fornecido pelo usuário, incluindo resumo, metodologia, NCM sugerida com justificativa detalhada, análise de barreiras, NCMs alternativas consideradas/descartadas, implicações e fontes.

## Considerações Importantes para a LLM

- **Iteração:** O processo de pesquisa é iterativo. Os resultados de uma pesquisa podem levar ao refinamento ou à necessidade de novas pesquisas.
- **Fontes Oficiais:** Priorizar fontes oficiais (TIPI, NCM gov.br, Receita Federal, ANVISA, MAPA) e bases de dados confiáveis.
- **Citações:** Sempre incluir citações para as fontes utilizadas nos resultados da pesquisa e na análise final.
- **Atualização:** A legislação tributária e aduaneira muda. Verificar a data de validade das informações e buscar as versões mais recentes dos documentos legais.
- **Dúvidas:** Em casos de ambiguidade ou complexidade, reconhecer a necessidade de consulta formal à Receita Federal (Solução de Consulta).

Este roteiro visa padronizar o processo de classificação fiscal, tornando-o mais eficiente e confiável para a LLM.
