DO $$
BEGIN 
	FOR I IN 10000..999999 LOOP
		INSERT INTO urls (id, original_url)
		VALUES (i, 'https://seed.com/' || i);
	END LOOP; 
END $$;
