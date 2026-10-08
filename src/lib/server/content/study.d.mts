import type { PrismaClient } from '@prisma/client';
import type { z } from 'zod';
export type StudySource={id:string;sourceId:string;printedPage:string|null;source:{title:string;sourceType:string}};
export type StudyExample={id:string;japanese:string;reading:string;translation:string;origin:string;sources:StudySource[]};
export type GrammarComparison={id:string;difference:string;origin:string;sources:StudySource[];patterns:{itemId:string;pattern:string;example:StudyExample}[]};
export type StudyContent={examples:StudyExample[];sources:StudySource[];readings?:{on:string[];kun:string[]};grammar?:{formation:string[];guidance:string;guidanceLabel:string;guidanceOrigin:string;sources:StudySource[];comparisons:GrammarComparison[]}};
export const comparisonSchema:z.ZodType;
export function grammarComparisons(db:PrismaClient,itemId:string):Promise<GrammarComparison[]>;
export function studyContent(db:PrismaClient,card:{itemId:string;contentId?:string|null;promptSpecJson:{itemRevision:number}}):Promise<StudyContent|null>;
