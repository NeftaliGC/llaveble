#include "b64url.h"

static int8_t b64val(char c) {
  if (c >= 'A' && c <= 'Z') return c - 'A';
  if (c >= 'a' && c <= 'z') return c - 'a' + 26;
  if (c >= '0' && c <= '9') return c - '0' + 52;
  if (c == '-' || c == '+') return 62;
  if (c == '_' || c == '/') return 63;
  return -1;
}

int b64urlDecode(const char* in, size_t inLen, uint8_t* out, size_t outMax) {
  while (inLen > 0 && in[inLen - 1] == '=') inLen--;
  if (inLen % 4 == 1) return -1;
  size_t outLen = (inLen * 3) / 4;
  if (outLen > outMax) return -1;

  uint32_t acc = 0;
  int bits = 0;
  size_t o = 0;
  for (size_t i = 0; i < inLen; i++) {
    int8_t v = b64val(in[i]);
    if (v < 0) return -1;
    acc = (acc << 6) | (uint32_t)v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (uint8_t)((acc >> bits) & 0xFF);
    }
  }
  return (int)o;
}

static int8_t hexval(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

bool hexToBytes(const char* hex, uint8_t* out, size_t outLen) {
  if (strlen(hex) != outLen * 2) return false;
  for (size_t i = 0; i < outLen; i++) {
    int8_t hi = hexval(hex[2 * i]), lo = hexval(hex[2 * i + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = (uint8_t)((hi << 4) | lo);
  }
  return true;
}
