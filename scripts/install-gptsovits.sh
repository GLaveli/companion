#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GPT_DIR="$ROOT/vendor/GPT-SoVITS"
VENV="$GPT_DIR/.venv"
PYTHON="${PYTHON:-/opt/homebrew/bin/python3.11}"

if [[ ! -d "$GPT_DIR" ]]; then
  echo "Clonando GPT-SoVITS..."
  git clone --depth 1 https://github.com/RVC-Boss/GPT-SoVITS.git "$GPT_DIR"
fi

if [[ ! -x "$PYTHON" ]]; then
  echo "Python 3.11 nao encontrado. Instale: brew install python@3.11"
  exit 1
fi

if [[ ! -d "$VENV" ]]; then
  echo "Criando venv em $VENV"
  "$PYTHON" -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"
pip install -U pip wheel setuptools

echo "Instalando PyTorch (Apple Silicon / MPS)..."
pip install torch torchaudio

echo "Instalando dependencias GPT-SoVITS..."
pip install -r "$GPT_DIR/extra-req.txt" --no-deps || true
pip install -r "$GPT_DIR/requirements.txt"
pip install torchcodec

cd "$GPT_DIR"

# HuggingFace LFS files need huggingface_hub (curl only gets stub archives).
hf_download() {
  local filename="$1"
  echo "Baixando $filename via huggingface_hub..."
  python - <<PY
from huggingface_hub import hf_hub_download
from pathlib import Path

path = hf_hub_download(
    repo_id="XXXXRT/GPT-SoVITS-Pretrained",
    filename="${filename}",
    local_dir=".",
)
print(f"OK: {path} ({Path(path).stat().st_size // 1_000_000} MB)")
PY
}

extract_zip_into() {
  local zipfile="$1"
  local dest="$2"
  python - <<PY
import zipfile
from pathlib import Path

zip_path = Path("${zipfile}")
dest = Path("${dest}")
dest.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(zip_path) as zf:
    zf.extractall(dest)
print(f"Extraido: {zip_path.name} -> {dest}")
PY
}

V2_CKPT="GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-5kh-longer-epoch=12-step=369668.ckpt"
if [[ ! -f "$V2_CKPT" ]]; then
  hf_download "pretrained_models.zip"
  extract_zip_into "pretrained_models.zip" "GPT_SoVITS"
  rm -f pretrained_models.zip
  # fallback: zip antigo extraía em ./pretrained_models
  if [[ -d pretrained_models && ! -f "$V2_CKPT" ]]; then
    rm -rf GPT_SoVITS/pretrained_models
    mv pretrained_models GPT_SoVITS/
  fi
fi

if [[ ! -d GPT_SoVITS/text/G2PWModel ]]; then
  hf_download "G2PWModel.zip"
  extract_zip_into "G2PWModel.zip" "GPT_SoVITS/text"
  rm -f G2PWModel.zip
fi

PY_PREFIX="$(python -c 'import sys; print(sys.prefix)')"
if [[ ! -d "$PY_PREFIX/nltk_data" ]]; then
  hf_download "nltk_data.zip"
  extract_zip_into "nltk_data.zip" "$PY_PREFIX"
  rm -f nltk_data.zip
fi

PYOPENJTALK_PREFIX="$(python -c 'import os, pyopenjtalk; print(os.path.dirname(pyopenjtalk.__file__))')"
if [[ ! -d "$PYOPENJTALK_PREFIX/open_jtalk_dic_utf_8-1.11" ]]; then
  hf_download "open_jtalk_dic_utf_8-1.11.tar.gz"
  tar -xzf open_jtalk_dic_utf_8-1.11.tar.gz -C "$PYOPENJTALK_PREFIX"
  rm -f open_jtalk_dic_utf_8-1.11.tar.gz
fi

# Companion override: use v2 on MPS when available, else CPU
CFG="$GPT_DIR/GPT_SoVITS/configs/tts_infer.yaml"
if [[ -f "$CFG" ]]; then
  python - <<'PY'
from pathlib import Path
import yaml

cfg_path = Path("GPT_SoVITS/configs/tts_infer.yaml")
data = yaml.safe_load(cfg_path.read_text())
import torch
device = "mps" if torch.backends.mps.is_available() else "cpu"
for key in data:
    if isinstance(data[key], dict) and "device" in data[key]:
        data[key]["device"] = device
        data[key]["is_half"] = False
data["custom"] = dict(data.get("v2", {}))
data["custom"]["device"] = device
data["custom"]["is_half"] = False
cfg_path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False))
print(f"tts_infer.yaml -> device={device}")
PY
fi

echo ""
echo "GPT-SoVITS instalado em: $GPT_DIR"
echo "Inicie com: npm run gptsovits:start"
