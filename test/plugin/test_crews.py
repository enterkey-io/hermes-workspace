import unittest
import test_workspace
from bot_web.operations import InvalidOperation

class CrewTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp = test_workspace.WorkspaceTests.asyncSetUp
    asyncTearDown = test_workspace.WorkspaceTests.asyncTearDown
    async def test_crew_changes_preserve_role_reporting_and_replay_is_a_receipt(self):
        state=await self.service.invoke('workspace.describe',{})
        before=state['bots'][1]['role'] if isinstance(state['bots'],list) else state['bots']['amy']['role']
        revision=self.store.read()['revision']
        params={'id':'studio','name':'Studio','members':['amy'],'remove':False,'operation_id':'create-studio','expected_revision':revision}
        self.assertEqual((await self.service.invoke('crews.save',params))['state'],'completed')
        state=self.store.read();self.assertEqual(state['bots']['amy']['team'],'studio');self.assertEqual(state['bots']['amy']['manager'],'default');self.assertEqual(state['bots']['amy']['role'],before)
        calls=len(self.native.calls)
        self.assertEqual((await self.service.invoke('crews.save',params))['state'],'completed')
        self.assertTrue(all(method in {'profiles.list','bot_web.models','bot_web.identities'} for method,_ in self.native.calls[calls:]))
        self.assertEqual((await self.service.invoke('crews.save',{**params,'remove':True,'members':[],'operation_id':'remove-studio','expected_revision':state['revision']}))['state'],'completed')
        self.assertEqual(self.store.read()['teams'],[]);self.assertIsNone(self.store.read()['bots']['amy']['team']);self.assertEqual(self.store.read()['bots']['amy']['manager'],'default')
        self.assertFalse(any(method in {'prompt.submit','groups.create','profiles.create'} for method,_ in self.native.calls))
    async def test_crew_rejects_stale_unknown_duplicates_and_reused_nonce(self):
        revision=self.store.read()['revision']
        params={'id':'studio','name':'Studio','members':['amy'],'remove':False,'operation_id':'crew-save','expected_revision':revision}
        for change in [{'expected_revision':-1},{'members':['missing']},{'members':['amy','amy']}]:
            with self.assertRaises(InvalidOperation): await self.service.invoke('crews.save',{**params,**change})
        await self.service.invoke('crews.save',params)
        with self.assertRaises(InvalidOperation): await self.service.invoke('crews.save',{**params,'name':'Different'})
