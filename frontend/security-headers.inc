# Gemeinsame Security-Header fuer alle Antworten des Frontend-Containers.
# Wird in nginx.conf auf Server-Ebene UND in jedem location-Block mit eigenem
# add_header eingebunden: nginx vererbt add_header nicht in Bloecke, die selbst
# add_header setzen (sonst kamen u.a. index.html und Assets ohne diese Header -
# Security-Scan 2026-10-30).
add_header Strict-Transport-Security "max-age=31536000" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()" always;
