-- QC Parameters
SELECT id, name, description FROM qc_parameters;

-- QC Methods  
SELECT id, name, description FROM qc_methods;

-- QC Specifications (the critical one)
SELECT qs.id, qs.product_id, p.name AS product_name, qs.qc_type,
  qp.name AS parameter_name, qm.name AS method_name,
  qs.standard_value, qs.min_value, qs.max_value, qs.uom
FROM qc_specifications qs
LEFT JOIN products p ON qs.product_id = p.id
LEFT JOIN qc_parameters qp ON qs.parameter_id = qp.id
LEFT JOIN qc_methods qm ON qs.method_id = qm.id
ORDER BY qs.product_id, qs.id;
