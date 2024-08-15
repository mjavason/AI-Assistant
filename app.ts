import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import morgan from 'morgan';
import OpenAI from 'openai';

//#region App Setup
const app = express();
dotenv.config({ path: './.env' });
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const SWAGGER_OPTIONS = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Typescript SFA',
      version: '1.0.0',
      description:
        'This is a single file typescript template app for faster idea testing and prototyping. It contains tests, one demo root API call, basic async error handling, one demo axios call and .env support.',
      contact: {
        name: 'Orji Michael',
        email: 'orjimichael4886@gmail.com',
      },
    },
    servers: [
      {
        url: BASE_URL,
      },
    ],
    tags: [
      {
        name: 'Default',
        description: 'Default API Operations that come inbuilt',
      },
    ],
  },
  apis: ['**/*.ts'],
};

const swaggerSpec = swaggerJSDoc(SWAGGER_OPTIONS);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(morgan('dev'));

//#endregion

//#region Keys and Configs
const PORT = process.env.PORT || 5000;
const OPEN_AI_KEY = process.env.OPEN_AI_KEY || 'xxxx';
const baseURL = 'https://httpbin.org';
// const openAIConfig = new Configuration({ apiKey: OPEN_AI_KEY });
const openAI = new OpenAI({ apiKey: OPEN_AI_KEY });
const AIRules = [
  'Be helpful.',
  'Summarize in 30 words max.',
  'Avoid repeating the question; give direct answers.',
  // 'Limit scope to countries/capitals; reply just "#E-OS" otherwise.',
];

//#endregion

//#region Code here

//#region Functions

async function generateResponse(userContent: string) {
  const completion = await openAI.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: AIRules.toString(),
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
    tools: [
      {
        function: {
          name: 'convertToUpperCase',
          description: 'Converts the user content to uppercase.',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The content to convert to uppercase.',
              },
            },
            required: ['content'],
          },
        },
        type: 'function',
      },
      {
        function: {
          name: 'reverseString',
          description: 'Reverses the string.',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The content to reverse.',
              },
            },
            required: ['content'],
          },
        },
        type: 'function',
      },
      {
        function: {
          name: 'replaceSpacesWithDashes',
          description: 'Replaces spaces with dashes in the string.',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The content to modify.',
              },
            },
            required: ['content'],
          },
        },
        type: 'function',
      },
    ],
  });

  return completion.choices[0].message;
}

function convertToUpperCase(content: string) {
  console.log('Converting to uppercase...');
  return 'Uppercase: ' + content.toUpperCase();
}

function reverseString(content: string) {
  console.log('Reversing the string...');
  return 'Reverse: ' + content.split('').reverse().join('');
}

function replaceSpacesWithDashes(content: string) {
  console.log('Replacing spaces with dashes...');
  return 'Dashed: ' + content.replace(/\s+/g, '-');
}

function callChosenFunction(funcName: string, funcArguments: string) {
  const funcArgumentsParsed = JSON.parse(funcArguments);

  switch (funcName) {
    case 'convertToUpperCase':
      return convertToUpperCase(funcArgumentsParsed.content);
    case 'reverseString':
      return reverseString(funcArgumentsParsed.content);
    case 'replaceSpacesWithDashes':
      return replaceSpacesWithDashes(funcArgumentsParsed.content);
    default:
      return 'Unable to perform task';
  }
}

//#endregion Functions

//#region Routes

/**
 * @swagger
 * /prompt-bot:
 *   post:
 *     summary: Prompt an OpenAI bot
 *     description: Returns an object containing the bot's response to a provided question. The bot also performs three in-house functions, just ask the bot(Uppercase, Dash and Reverse)
 *     tags: [OpenAI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *                 description: The question to prompt the OpenAI bot.
 *                 example: "What is the capital of France?"
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.post('/prompt-bot', async (req: Request, res: Response) => {
  const userContent = req.body.question as string;

  if (userContent.split(' ').length > 30)
    return res.status(400).send({
      success: false,
      message: 'Prompt was too long. Must be less than 31 words.',
    });

  const data = await generateResponse(userContent); //#endregion
  if (data.content === '#E-OS')
    data.content = 'Sorry but that is outside my scope, how else can i help?';

  if (!data.content && data.tool_calls) {
    data.content = '';

    for (let i = 0; i < data.tool_calls.length; i++) {
      data.content += `${callChosenFunction(
        data.tool_calls[i].function.name,
        data.tool_calls[i].function.arguments
      )}\n`;
    }
  }

  return res.send({
    success: true,
    message: 'Bot responded successfully',
    data: data.content,
  });
});

//#endregion Routes

//#endregion Code here

//#region Server Setup

// Function to ping the server itself
async function pingSelf() {
  try {
    const { data } = await axios.get(BASE_URL);
    console.log(`Server pinged successfully: ${data.message}`);
    return true;
  } catch (e: any) {
    console.error(`Error pinging server: ${e.message}`);
    return false;
  }
}

// Route for external API call
/**
 * @swagger
 * /api:
 *   get:
 *     summary: Call a demo external API (httpbin.org)
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/api', async (req: Request, res: Response) => {
  try {
    const result = await axios.get(baseURL);
    return res.send({
      message: 'Demo API called (httpbin.org)',
      data: result.status,
    });
  } catch (error: any) {
    console.error('Error calling external API:', error.message);
    return res.status(500).send({ error: 'Failed to call external API' });
  }
});

// Route for health check
/**
 * @swagger
 * /:
 *   get:
 *     summary: API Health check
 *     description: Returns an object containing demo content
 *     tags: [Default]
 *     responses:
 *       '200':
 *         description: Successful.
 *       '400':
 *         description: Bad request.
 */
app.get('/', (req: Request, res: Response) => {
  return res.send({ message: 'API is Live!' });
});

// Middleware to handle 404 Not Found
/**
 * @swagger
 * /obviously/this/route/cant/exist:
 *   get:
 *     summary: API 404 Response
 *     description: Returns a non-crashing result when you try to run a route that doesn't exist
 *     tags: [Default]
 *     responses:
 *       '404':
 *         description: Route not found
 */
app.use((req: Request, res: Response) => {
  return res
    .status(404)
    .json({ success: false, message: 'API route does not exist' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // throw Error('This is a sample error');

  console.log(`${'\x1b[31m'}${err.message}${'\x1b][0m]'} `);
  return res
    .status(500)
    .send({ success: false, status: 500, message: err.message });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
});

// (for render services) Keep the API awake by pinging it periodically
setInterval(pingSelf, 600000);

//#endregion
