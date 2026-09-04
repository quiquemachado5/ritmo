import { expect, it } from "vitest";
import { validarPerfil } from "../profile-validation";
import { PERFIL_DEFECTO } from "../model/config";
it("admite proteína decimal y distingue límites de almacenamiento", () => {
  expect(validarPerfil({ ...PERFIL_DEFECTO, proteinaObjetivo: 1.6 })).toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, proteinaObjetivo: 160 })).not.toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, edad: 17 })).not.toBeNull();
  expect(validarPerfil({ ...PERFIL_DEFECTO, alturaCm: NaN })).not.toBeNull();
});
