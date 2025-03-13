#!/bin/bash

# Verifica se os parâmetros necessários foram informados
if [ "$#" -ne 8 ]; then
    echo "Uso: $0 <certificado.pfx> <senha_certificado> <entrada.pdf> <parta de saída> <email> <saida.pdf> <JSignPdf.jar>"
    exit 1
fi

CERTIFICADO="$1"
SENHA="$2"
INPUT_PDF="$3"
OUTPUT_DIR="$4"
EMAIL="$5"
OUTPUT_PDF="$6"
JAR_PATH="$7"
FILENAME="$8"


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
# JAR_PATH="JSignPdf.jar"
if [ ! -f "$JAR_PATH" ]; then
    echo "Arquivo $JAR_PATH não encontrado. Certifique-se de que ele está no diretório atual."
    exit 1
fi

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
  -c "$EMAIL" \
  -d "$OUTPUT_PDF" \
  -op "manifest_" \
  -os "" \
  -q

if [ $? -ne 0 ]; then
    echo "Erro ao assinar o PDF."
    exit 1
fi

echo "PDF assinado com sucesso: $OUTPUT_PDF"
