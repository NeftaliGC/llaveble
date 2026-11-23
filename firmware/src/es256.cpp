#include "es256.h"
#include <mbedtls/ecdsa.h>
#include <mbedtls/ecp.h>
#include <mbedtls/md.h>

void sha256(const uint8_t* msg, size_t len, uint8_t out[32]) {
  mbedtls_md(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), msg, len, out);
}

bool es256Verify(const uint8_t pub[65], const uint8_t* msg, size_t len, const uint8_t sig[64]) {
  uint8_t hash[32];
  sha256(msg, len, hash);

  mbedtls_ecp_group grp;
  mbedtls_ecp_point Q;
  mbedtls_mpi r, s;
  mbedtls_ecp_group_init(&grp);
  mbedtls_ecp_point_init(&Q);
  mbedtls_mpi_init(&r);
  mbedtls_mpi_init(&s);

  bool ok = mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256R1) == 0 &&
            mbedtls_ecp_point_read_binary(&grp, &Q, pub, 65) == 0 &&
            mbedtls_ecp_check_pubkey(&grp, &Q) == 0 &&
            mbedtls_mpi_read_binary(&r, sig, 32) == 0 &&
            mbedtls_mpi_read_binary(&s, sig + 32, 32) == 0 &&
            mbedtls_ecdsa_verify(&grp, hash, sizeof(hash), &Q, &r, &s) == 0;

  mbedtls_mpi_free(&r);
  mbedtls_mpi_free(&s);
  mbedtls_ecp_point_free(&Q);
  mbedtls_ecp_group_free(&grp);
  return ok;
}
