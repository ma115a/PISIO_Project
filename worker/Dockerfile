FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    tesseract-ocr \
    imagemagick \
    libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

RUN sed -i 's/domain="coder" rights="none" pattern="PDF"/domain="coder" rights="read|write" pattern="PDF"/' /etc/ImageMagick-6/policy.xml

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
