Yang sudah gue accept: WO dari MPS sekarang eksplisit source_type='MPS', existing WO yang punya mps_detail_id dibackfill menjadi MPS, dan sisanya tetap LEGACY_UNKNOWN — jadi tidak lagi asal dicap Manual. Manual WO juga sekarang wajib punya alasan, menyimpan creator, dan diberi source_type='MANUAL'. Production Planning juga sekarang join ke MPS, mengembalikan mps_number, mps_detail_id, week, dan secara default menyembunyikan completed/closed/cancelled. Trace modal juga sudah ada di Production Planning.

Tapi gue nemu beberapa masalah yang harus dibalikin ke development:

P0 — Forecast lineage masih putus. mps_detail_sources sebenarnya sudah menyimpan forecast_header_id, week, year, dan quantity. Bahkan endpoint MPS existing sudah join forecast_headers dan punya forecast_number. Tetapi endpoint WO Trace cuma mengembalikan Forecast sebagai { type: 'FORECAST', quantity }; tidak join forecast_headers, tidak kasih forecast_number, week atau year. Jadi pertanyaan “WO ini berasal dari Forecast yang mana?” masih belum bisa dijawab.
P0 — Filter bulan Work Orders ternyata tidak bekerja. Frontend mengirim month dan year ke /workorders. Tetapi backend GET /workorders memakai \_req dan query-nya tidak punya WHERE month/year sama sekali — langsung return seluruh work_orders ORDER BY created_at DESC. Ini bisa menjadi salah satu alasan kenapa lo melihat WO sangat banyak: pilih bulan di UI, backend tetap kirim semua periode.
P0 runtime — /workorders/summary berpotensi ketabrak /:id. Di router saat ini router.get('/:id') didefinisikan sebelum router.get('/summary'). Frontend memanggil /workorders dan /workorders/summary bersamaan dengan Promise.all. Karena /summary adalah satu segment, Express dapat menangkap "summary" sebagai :id, lalu query WO id summary dan return 404. Route statis /summary harus diletakkan sebelum /:id.
P1 — Quick Status UI memanggil endpoint yang tidak ada. Work Orders memanggil PATCH /workorders/:id/status. Tapi router Work Order current tidak punya router.patch(...); update status yang tersedia adalah bagian dari PUT /:id. Jadi dropdown status berpotensi selalu gagal.
P1 — Manual reason belum punya field canonical. Requirement kita sebenarnya source_reason. Development sekarang menyimpan reason itu ke kolom notes. Gue lebih prefer buat dedicated source_reason column, karena notes adalah catatan operasional WO dan jangan dicampur dengan alasan business kenapa WO itu dibuat.

Ada satu lagi yang jangan dilewatkan: mereka mulai memperbaiki MRP → PR lineage, bagus. PR detail-specific sekarang membawa source_type='MRP', mps_header_id, dan mps_detail_id. Tetapi standalone /mrp/generate-pr cuma diberi source_type='MRP' tanpa MPS reference. Jadi kalau PR dibuat dari aggregate MRP, pertanyaan “PR ini procurement untuk demand/MPS yang mana?” masih belum bisa dijawab penuh.

Jadi comment gue ke development sekarang:

WO Provenance Review — Cycle #2 / f1b9d4f

Direction accepted. Do not redesign the new MPS / MANUAL / LEGACY_UNKNOWN model.

Before declaring WO lineage FIRM, close these remaining gaps:

P0-1: /workorders must honor month/year/status filters. Current frontend sends month/year but backend returns all WOs, which is one reason Production/WO screens can appear overloaded.

P0-2: Complete Forecast provenance in /workorders/:id/trace: join forecast_headers through forecast_header_id and return forecast_number, week, year and quantity. FORECAST + quantity alone is not traceable.

P0-3: Move static /summary route before /:id so /workorders/summary cannot be interpreted as work-order ID "summary".

P1-1: Align quick status UI/API. Frontend currently calls PATCH /workorders/:id/status, but backend does not expose that contract.

P1-2: Store manual WO business reason in dedicated source_reason, not generic notes.

P1-3: Complete MRP→PR lineage for aggregate PR generation. source_type='MRP' alone is insufficient; every PR/PR item must be traceable to the MPS detail(s) / demand source(s) that created the requirement.

Acceptance test must use real records:

SO → MPS → WO → Trace

Forecast → MPS → WO → Trace

Project → MPS → WO → Trace

Manual WO → Reason + Creator

and verify that changing the Work Orders month actually changes the dataset returned by the API.

Do not mark lineage FIRM until every displayed WO can answer: why it exists, where demand came from, who created it, and which period/week owns it.

Jadi sekarang gue belum suruh mereka lanjut feature lain. Khususnya temuan filter bulan itu menurut gue penting banget terhadap concern awal lo: banyak WO bukan hanya masalah provenance — list API-nya sendiri saat ini memang tidak menghormati filter periode. Itu harus dibereskan dulu bro
