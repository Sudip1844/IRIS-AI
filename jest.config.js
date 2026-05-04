module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/main/services/**/*.ts',
    'src/main/logic/**/*.ts',
    'src/main/security/**/*.ts',
    '!src/main/**/*.d.ts',
    '!src/main/index.ts',
    '!src/main/auto/**',
    '!src/main/handlers/**',
    '!src/main/workflow/**'
  ],
  coverageThreshold: {
    'src/main/services/error-utils.ts': {
      branches: 85,
      functions: 80,
      lines: 82,
      statements: 82
    },
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },
  moduleNameMapper: {
    '^@renderer/(.*)$': '<rootDir>/src/renderer/src/$1'
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/out/'],
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        isolatedModules: true
      }
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/main/services/__tests__/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/src/main/services/__tests__/setup-jest.ts'],
  moduleDirectories: ['node_modules', 'src']
}
