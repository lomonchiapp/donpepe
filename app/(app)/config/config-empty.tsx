import { Card, CardContent } from "@/components/ui/card";

export function ConfigEmpty() {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Se necesita ejecutar las migraciones de Supabase (incluyendo seed)
          y crear un registro en <code>app_users</code> vinculado a tu usuario
          autenticado.
        </p>
      </CardContent>
    </Card>
  );
}
