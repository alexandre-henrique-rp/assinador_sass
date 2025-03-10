#!/bin/bash

# Verifica se os quatro parâmetros foram informados
if [ "$#" -ne 4 ]; then
    echo "Uso: $0 <certificate.pem> <private_key.pem> <entrada.pdf> <saida.pdf>"
    exit 1
fi

CERT_PEM="$1"
PRIVATE_KEY="$2"
INPUT_PDF="$3"
OUTPUT_PDF="$4"

# Converte o certificado .pem para .crt (formato DER)
CERT_CRT="certificate.crt"
echo "Convertendo certificado PEM para CRT..."
openssl x509 -in "$CERT_PEM" -outform der -out "$CERT_CRT"
if [ $? -ne 0 ]; then
    echo "Erro ao converter o certificado PEM para CRT."
    exit 1
fi

# Verifica se o open-pdf-sign.jar está no diretório atual (ou ajuste o caminho conforme necessário)
JAR_PATH="open-pdf-sign.jar"
if [ ! -f "$JAR_PATH" ]; then
    echo "Arquivo $JAR_PATH não encontrado. Certifique-se de que ele está no diretório atual."
    exit 1
fi

# Assina o PDF com open-pdf-sign.jar
echo "Assinando o PDF com open-pdf-sign.jar..."
java -jar "$JAR_PATH" \
  --input "$INPUT_PDF" \
  --output "$OUTPUT_PDF" \
  --certificate "$CERT_CRT" \
  --key "$PRIVATE_KEY" \
  --passphrase "1234"
  

if [ $? -ne 0 ]; then
    echo "Erro ao assinar o PDF."
    rm -f "$CERT_CRT"
    exit 1
fi

# Remove o arquivo CRT temporário, pois só o PDF assinado será mantido
rm -f "$CERT_CRT"

echo "PDF assinado com sucesso: $OUTPUT_PDF"
