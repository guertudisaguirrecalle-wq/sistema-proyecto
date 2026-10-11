-- ============================================================
-- COUTURE BYTE MARKET — PRODUCTOS DE EJEMPLO (con imágenes ya funcionando)
-- ============================================================
-- Fotografías de muestra de moda femenina, solo para que la tienda se vea
-- completa desde el primer momento. Reemplázalas cuando quieras desde el
-- Panel de Administrador → Editar producto → Subir nueva imagen.
-- (Si alguna imagen de muestra llegara a no cargar, el sitio ya tiene un
-- reemplazo visual automático en los colores de la marca — ver utils.js).

do $$
declare
  cat_vestidos int; cat_blusas int; cat_pantalones int; cat_conjuntos int;
  pid uuid;
begin
  select id into cat_vestidos from categorias where slug = 'vestidos';
  select id into cat_blusas from categorias where slug = 'blusas';
  select id into cat_pantalones from categorias where slug = 'pantalones';
  select id into cat_conjuntos from categorias where slug = 'conjuntos';

  -- ---------- VESTIDOS ----------
  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Vestido Aurora', 'Vestido midi de gasa fluida en rosa empolvado, con escote cruzado y caída delicada. Ideal para ocasiones especiales.', 320, cat_vestidos, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700&q=80&auto=format&fit=crop', true, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',3),(pid,'S',6),(pid,'M',4),(pid,'L',0),(pid,'XL',2);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Vestido Lumière', 'Vestido largo satinado color champán, silueta entallada con abertura lateral sutil.', 410, cat_vestidos, 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=700&q=80&auto=format&fit=crop', true, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',5),(pid,'M',5),(pid,'L',3),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Vestido Bruma', 'Vestido corto de tul lavanda con textura de flores bordadas a mano.', 275, cat_vestidos, 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=700&q=80&auto=format&fit=crop', false, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',4),(pid,'S',7),(pid,'M',3),(pid,'L',2),(pid,'XL',0);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Vestido Nube', 'Vestido veraniego en algodón crema, tirantes finos y falda amplia vaporosa.', 240, cat_vestidos, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=700&q=80&auto=format&fit=crop', false, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',5),(pid,'S',6),(pid,'M',6),(pid,'L',4),(pid,'XL',2);

  -- ---------- BLUSAS ----------
  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Blusa Luna', 'Blusa de seda en tono nude con mangas abullonadas y botones perlados.', 165, cat_blusas, 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=700&q=80&auto=format&fit=crop', true, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',3),(pid,'S',8),(pid,'M',7),(pid,'L',5),(pid,'XL',2);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Blusa Amelie', 'Blusa lila de cuello en V con detalle de encaje en el escote.', 145, cat_blusas, 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=700&q=80&auto=format&fit=crop', false, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',5),(pid,'M',5),(pid,'L',3),(pid,'XL',0);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Blusa Rosé', 'Blusa cropped rosa pastel de manga larga, tejido ligero de verano.', 130, cat_blusas, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=700&q=80&auto=format&fit=crop', false, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',4),(pid,'S',6),(pid,'M',4),(pid,'L',2),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Blusa Cielo', 'Blusa oversize color beige con cuello mao y textura de lino suave.', 150, cat_blusas, 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=700&q=80&auto=format&fit=crop', true, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',3),(pid,'S',5),(pid,'M',5),(pid,'L',3),(pid,'XL',2);

  -- ---------- PANTALONES ----------
  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Pantalón Chloé', 'Pantalón palazzo crema de tiro alto, caída fluida y cintura elastizada.', 210, cat_pantalones, 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=700&q=80&auto=format&fit=crop', false, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',6),(pid,'M',6),(pid,'L',4),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Pantalón Sienna', 'Pantalón recto beige de vestir, corte clásico con pinzas frontales.', 195, cat_pantalones, 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=700&q=80&auto=format&fit=crop', false, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',3),(pid,'S',5),(pid,'M',5),(pid,'L',3),(pid,'XL',0);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Pantalón Mimosa', 'Pantalón wide leg lila pastel, tela ligera ideal para looks de oficina o salidas.', 220, cat_pantalones, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=700&q=80&auto=format&fit=crop', true, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',4),(pid,'M',4),(pid,'L',2),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Pantalón Perla', 'Pantalón capri nude con textura satinada y bolsillos laterales.', 185, cat_pantalones, 'https://images.unsplash.com/photo-1475178626620-a4d074967452?w=700&q=80&auto=format&fit=crop', false, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',3),(pid,'S',5),(pid,'M',4),(pid,'L',3),(pid,'XL',2);

  -- ---------- CONJUNTOS ----------
  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Conjunto Bloom', 'Conjunto de blusa y pantalón a juego en tono champán, con textura satinada.', 380, cat_conjuntos, 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&q=80&auto=format&fit=crop', true, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',1),(pid,'S',4),(pid,'M',4),(pid,'L',2),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Conjunto Dolce', 'Conjunto crop top y falda midi en lila suave, perfecto para eventos de tarde.', 350, cat_conjuntos, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=700&q=80&auto=format&fit=crop', true, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',5),(pid,'M',3),(pid,'L',2),(pid,'XL',0);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Conjunto Frost', 'Conjunto blazer y short en beige, corte moderno y elegante.', 400, cat_conjuntos, 'https://images.unsplash.com/photo-1548624313-0396c75f6e2c?w=700&q=80&auto=format&fit=crop', false, false)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',1),(pid,'S',3),(pid,'M',3),(pid,'L',2),(pid,'XL',1);

  insert into productos (nombre, descripcion, precio, categoria_id, imagen_url, destacado, nuevo)
    values ('Conjunto Petal', 'Conjunto de dos piezas en rosa empolvado, blusa cruzada y pantalón fluido.', 365, cat_conjuntos, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=700&q=80&auto=format&fit=crop', false, true)
    returning id into pid;
  insert into producto_tallas (producto_id, talla, stock) values
    (pid,'XS',2),(pid,'S',4),(pid,'M',4),(pid,'L',3),(pid,'XL',1);

end $$;
