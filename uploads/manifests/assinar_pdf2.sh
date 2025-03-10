#!/bin/bash

# Verifica se os parâmetros necessários foram informados
if [ "$#" -ne 4 ]; then
    echo "Uso: $0 <certificado.pfx> <senha_certificado> <entrada.pdf> <saida.pdf>"
    exit 1
fi

CERTIFICADO="$1"
SENHA="$2"
INPUT_PDF="$3"
OUTPUT_PDF="$4"

# Verifica se os arquivos existem
if [ ! -f "$CERTIFICADO" ]; then
    echo "Erro: Arquivo de certificado $CERTIFICADO não encontrado."
    exit 1
fi

if [ ! -f "$INPUT_PDF" ]; then
    echo "Erro: Arquivo PDF de entrada $INPUT_PDF não encontrado."
    exit 1
fi

# Verifica se o JSignPdf.jar está no diretório atual
JAR_PATH="JSignPdf.jar"
if [ ! -f "$JAR_PATH" ]; then
    echo "Arquivo $JAR_PATH não encontrado. Certifique-se de que ele está no diretório atual."
    exit 1
fi

# Extrai o diretório de saída do nome do arquivo
OUTPUT_DIR=$(dirname "$OUTPUT_PDF")
mkdir -p "$OUTPUT_DIR"

# Assina o PDF com JSignPdf.jar
echo "Assinando o PDF com JSignPdf.jar..."
java -jar "$JAR_PATH" \
  "$INPUT_PDF" \
  -kst PKCS12 \
  -ksf "$CERTIFICADO" \
  -ksp "$SENHA" \
  -ha SHA256 \
  -a \
  -r "Documento assinado digitalmente" \
  -l "Assinador Sisnato" \
  -d "$OUTPUT_DIR" \
  -op "$(basename "$OUTPUT_PDF" .pdf)" \
  -os "" \
  -q

if [ $? -ne 0 ]; then
    echo "Erro ao assinar o PDF."
    exit 1
fi

echo "PDF assinado com sucesso: $OUTPUT_PDF"
