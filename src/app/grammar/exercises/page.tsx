import { db } from '@/lib/server/db';
import { LOCAL_USER_ID } from '@/lib/server/review/service.mjs';
import { listLessonExercises,currentLessonExercises } from '@/lib/server/lesson-exercises/service.mjs';
import { LessonExercises } from '@/components/lesson-exercises';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export default async function LessonExercisesPage(){
 const [lessons,current]=await Promise.all([listLessonExercises(db,LOCAL_USER_ID),currentLessonExercises(db,LOCAL_USER_ID)]);
 return <><h1>Ungraded lesson exercises</h1><p className="lead">Mark every grammar point in a lesson studied to unlock its source exercises. Commit your answer before viewing feedback.</p><p>These exercises do not change your review schedule or scored accuracy.</p><LessonExercises lessons={lessons} initial={current}/></>;
}
