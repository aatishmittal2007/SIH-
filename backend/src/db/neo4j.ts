import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'tracex_password';

let driver: Driver | null = null;

export const getNeo4jDriver = (): Driver => {
  if (!driver) {
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  }
  return driver;
};

export const getNeo4jSession = (): Session => {
  return getNeo4jDriver().session();
};

export const closeNeo4j = async (): Promise<void> => {
  if (driver) {
    await driver.close();
    driver = null;
  }
};

export const initNeo4jConstraints = async (): Promise<void> => {
  const session = getNeo4jSession();
  try {
    const constraints = [
      `CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE`,
      `CREATE CONSTRAINT case_id_unique IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE`,
      `CREATE CONSTRAINT evidence_id_unique IF NOT EXISTS FOR (ev:Evidence) REQUIRE ev.id IS UNIQUE`,
      `CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (ev:Event) REQUIRE ev.id IS UNIQUE`,
      `CREATE CONSTRAINT location_id_unique IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE`,
      `CREATE INDEX entity_normalized_idx IF NOT EXISTS FOR (e:Entity) ON (e.normalizedValue)`,
      `CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)`,
      `CREATE INDEX case_number_idx IF NOT EXISTS FOR (c:Case) ON (c.caseNumber)`,
    ];

    for (const query of constraints) {
      await session.run(query);
    }
    console.log('[Neo4j] Schema constraints & indexes verified/created successfully.');
  } catch (error) {
    console.error('[Neo4j] Error initializing constraints:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export const clearNeo4jDatabase = async (): Promise<void> => {
  const session = getNeo4jSession();
  try {
    await session.run(`MATCH (n) DETACH DELETE n`);
    console.log('[Neo4j] Graph database cleared.');
  } finally {
    await session.close();
  }
};
