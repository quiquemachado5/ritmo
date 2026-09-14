-- Funciones de calidad publicables por etapas. Memoria y reparación empiezan
-- en piloto; el contexto de líquidos es seguro y queda disponible para todos.
insert into public.platform_features(key,label,description,state,sort_order) values
  ('nutrition_memory','Memoria nutricional','Reutiliza platos e ingredientes únicamente después de una corrección confirmada.','pilot',70),
  ('fluid_context','Contexto de líquidos','Interpreta alcohol, sal, cenas tardías y sueño como fluctuaciones transitorias, no grasa.','public',80),
  ('data_health','Salud de datos','Detecta incoherencias y ofrece solo reparaciones reconstruibles sin decidir por la persona.','pilot',90)
on conflict (key) do update set label=excluded.label,description=excluded.description,sort_order=excluded.sort_order;

insert into public.ritmo_schema_version(singleton,version) values(true,'202609140003')
on conflict(singleton) do update set version=excluded.version,aplicado_en=now()
where public.ritmo_schema_version.version < excluded.version;
