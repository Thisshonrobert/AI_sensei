import { Review } from '@/components/review';
export default async function ReviewPage({searchParams}:{searchParams:Promise<{start?:string}>}){const {start}=await searchParams;return <><h1>One objective at a time</h1><p className="lead">Recall first. Reveal, assess honestly, and save one rating.</p><Review initialStart={['reviews','learning'].includes(start||'')?start:undefined}/></>;}
