-- docs/252: traducción del chat de soporte. Guarda la traducción de cada mensaje
-- ({ text, from, to }) para no traducirlo cada vez que se abre. Sin esta columna el chat
-- sigue funcionando, solo que sin traducción.
alter table public.support_messages add column if not exists translation jsonb;
