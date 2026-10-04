/**
 * Dynamically load the producer module. tsup inlines @chalkframes/producer
 * via noExternal so this resolves in the published bundle.
 */
export async function loadProducer() {
  return await import("@chalkframes/producer");
}
