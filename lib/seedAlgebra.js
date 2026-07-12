// Стартовая структура предмета «Алгебра» из Algebra_Complete_Study_Guide.docx

export const algebraSeed = {
  ru: {
    subject: "Алгебра",
    topics: [
      {
        name: "1. Основные свойства операций",
        children: [
          "Переместительное свойство",
          "Сочетательное свойство",
          "Распределительное свойство",
          "Нейтральный и обратный элементы",
        ],
      },
      { name: "2. Правила знаков", children: [] },
      { name: "3. Правила степеней", children: [] },
      { name: "4. Правила корней (радикалов)", children: [] },
      {
        name: "5. Правила решения уравнений",
        children: ["Порядок действий (PEMDAS / BODMAS)"],
      },
      { name: "6. Формулы сокращённого умножения", children: [] },
      { name: "7. Правила дробей", children: [] },
      { name: "8. Формула квадратного уравнения", children: [] },
      { name: "9. Запрещённые действия", children: [] },
      { name: "10. Неравенства (особое правило)", children: [] },
    ],
  },
  en: {
    subject: "Algebra",
    topics: [
      {
        name: "1. Basic Properties of Operations",
        children: [
          "Commutative Property",
          "Associative Property",
          "Distributive Property",
          "Identity & Inverse",
        ],
      },
      { name: "2. Rules of Signs", children: [] },
      { name: "3. Rules of Exponents (Powers)", children: [] },
      { name: "4. Rules of Roots (Radicals)", children: [] },
      {
        name: "5. Rules for Solving Equations",
        children: ["Order of Operations (PEMDAS / BODMAS)"],
      },
      { name: "6. Special Algebraic Identities", children: [] },
      { name: "7. Rules for Fractions", children: [] },
      { name: "8. The Quadratic Formula", children: [] },
      { name: "9. Important “Forbidden” Rules", children: [] },
      { name: "10. Inequalities (Special Rule)", children: [] },
    ],
  },
};
