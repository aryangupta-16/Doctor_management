(stop all services if running on 5432)
docker compose up -d
docker ps

npx prisma migrate dev --name init
npx prisma studio

npm run dev

npm run worker:email

npm run seed for database creation